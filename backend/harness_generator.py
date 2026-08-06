from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

from llm_client import chat_completion

BASE_DIR = Path(__file__).resolve().parent
PROMPT_DIR = BASE_DIR / "prompts"
PLAN_PROMPT_PATH = PROMPT_DIR / "harness_skill_plan.txt"
CLAUDE_PROMPT_PATH = PROMPT_DIR / "harness_claude_generation.txt"
SKILL_PROMPT_PATH = PROMPT_DIR / "harness_skill_generation.txt"

SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "__pycache__",
    "artifacts",
    "downloads",
    ".next",
    ".cache",
}
SKIP_FILE_NAMES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "uv.lock",
}
TEXT_EXTENSIONS = {
    ".css",
    ".csv",
    ".env.example",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
MAX_FILE_CHARS = 16000
MAX_TOTAL_CHARS = 90000


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts) or path.name in SKIP_FILE_NAMES


def is_text_file(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTENSIONS or path.name in TEXT_EXTENSIONS


def build_tree(root: Path) -> str:
    lines: list[str] = []
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if should_skip(rel):
            continue
        depth = len(rel.parts) - 1
        marker = "/" if path.is_dir() else ""
        lines.append(f"{'  ' * depth}{rel.name}{marker}")
    return "\n".join(lines)


def collect_text_files(root: Path) -> str:
    blocks: list[str] = []
    total = 0
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if path.is_dir() or should_skip(rel) or not is_text_file(path):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        content = content[:MAX_FILE_CHARS]
        block = f"--- {rel.as_posix()} ---\n{content}"
        if total + len(block) > MAX_TOTAL_CHARS:
            remaining = MAX_TOTAL_CHARS - total
            if remaining <= 0:
                break
            block = block[:remaining]
        blocks.append(block)
        total += len(block)
        if total >= MAX_TOTAL_CHARS:
            break
    return "\n\n".join(blocks)


def collect_reference_text_files(root: Path, reference_files: list[str] | None) -> str:
    blocks: list[str] = []
    seen: set[str] = set()
    for reference in reference_files or []:
        rel = Path(str(reference).strip())
        if not rel.as_posix() or rel.is_absolute() or ".." in rel.parts:
            continue
        if rel.as_posix() in seen:
            continue
        seen.add(rel.as_posix())
        path = root / rel
        if not path.exists() or not path.is_file() or should_skip(rel) or not is_text_file(path):
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        blocks.append(f"--- {rel.as_posix()} ---\n{content[:MAX_FILE_CHARS]}")
    return "\n\n".join(blocks)


def render_template(path: Path, replacements: dict[str, str]) -> str:
    value = path.read_text(encoding="utf-8")
    for key, replacement in replacements.items():
        value = value.replace("{{" + key + "}}", replacement)
    return value


def strip_json_fence(text: str) -> str:
    value = text.strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        value = "\n".join(lines).strip()
    return value


def parse_json_response(text: str) -> dict:
    value = strip_json_fence(text)
    try:
        return json.loads(value)
    except json.JSONDecodeError as original_error:
        decoder = json.JSONDecoder()
        start = value.find("{")
        while start >= 0:
            try:
                data, _ = decoder.raw_decode(value[start:])
                return data
            except json.JSONDecodeError:
                start = value.find("{", start + 1)
        raise original_error


def validate_plan(plan: dict) -> dict:
    candidates = plan.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("Skill plan must contain a non-empty candidates list.")
    allowed_skill_types = {"guide", "skeleton"}
    allowed_candidate_keys = {
        "slug",
        "title",
        "skill_type",
        "reusable_pattern",
        "required_inputs",
        "reference_files",
        "diffusion_score",
        "recommended",
        "reason",
    }
    for candidate in candidates:
        if not isinstance(candidate, dict) or not candidate.get("slug"):
            raise ValueError("Each skill candidate must contain a slug.")
        skill_type = candidate.get("skill_type")
        if skill_type not in allowed_skill_types:
            raise ValueError(f"Skill candidate {candidate.get('slug')} must contain skill_type in {sorted(allowed_skill_types)}.")
        extra_keys = sorted(set(candidate) - allowed_candidate_keys)
        if extra_keys:
            raise ValueError(f"Skill candidate {candidate.get('slug')} contains unsupported keys: {extra_keys}")
    selected = [str(slug) for slug in plan.get("selected_skill_slugs", [])]
    valid_slugs = {str(candidate.get("slug")) for candidate in candidates}
    plan["selected_skill_slugs"] = [slug for slug in selected if slug in valid_slugs]
    if not plan["selected_skill_slugs"]:
        plan["selected_skill_slugs"] = [str(candidate["slug"]) for candidate in candidates if candidate.get("recommended") is True][:2]
    return plan


def parse_files_response(text: str, allowed_roots: set[str]) -> list[dict[str, str]]:
    data = parse_json_response(text)
    files = data.get("files")
    if not isinstance(files, list) or not files:
        raise ValueError("LLM response must contain a non-empty files list.")
    normalized: list[dict[str, str]] = []
    for item in files:
        if not isinstance(item, dict) or not item.get("path") or "content" not in item:
            raise ValueError("Each file item must contain path and content.")
        path = Path(str(item["path"]))
        if path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Unsafe output path: {item['path']}")
        if path.parts[0] not in allowed_roots:
            raise ValueError(f"Output path must start with one of {sorted(allowed_roots)}: {item['path']}")
        normalized.append({"path": path.as_posix(), "content": str(item["content"])})
    return normalized


def validate_skill_files(skill_slug: str, files: list[dict[str, str]]) -> None:
    skill_path = f"skills/{skill_slug}/SKILL.md"
    skill_doc = next((item for item in files if item.get("path") == skill_path), None)
    if skill_doc is None:
        raise ValueError(f"Skill output must include {skill_path}.")

    content = str(skill_doc.get("content", "")).lstrip()
    if not content.startswith("---"):
        raise ValueError(f"{skill_path} must start with YAML frontmatter.")
    parts = content.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"{skill_path} has incomplete YAML frontmatter.")
    frontmatter = parts[1]
    body = parts[2]
    if f"name: {skill_slug}" not in frontmatter:
        raise ValueError(f"{skill_path} frontmatter must contain name: {skill_slug}.")
    if "description:" not in frontmatter:
        raise ValueError(f"{skill_path} frontmatter must contain description.")

    forbidden_body_headings = [
        "## When to use",
        "## When To Use",
        "## When to use this skill",
        "## Use when",
        "## Trigger",
        "## Triggering",
        "# Reference implementation notes",
        "## Reference implementation notes",
        "# Reference implementation",
        "## Reference implementation",
    ]
    matched = next((heading for heading in forbidden_body_headings if heading in body), None)
    if matched:
        raise ValueError(f"{skill_path} contains forbidden body heading: {matched}")

    script_paths = [item.get("path") for item in files if str(item.get("path", "")).startswith(f"skills/{skill_slug}/scripts/")]
    missing_refs: list[str] = []
    for script_path in script_paths:
        script_ref = str(Path(str(script_path)).relative_to(f"skills/{skill_slug}"))
        if script_ref not in body:
            missing_refs.append(script_ref)
    if missing_refs:
        raise ValueError(f"{skill_path} must reference generated scripts: {missing_refs}")


def write_files(files: list[dict[str, str]], output_dir: Path) -> None:
    for item in files:
        target = output_dir / item["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(str(item["content"]).rstrip() + "\n", encoding="utf-8")


def ensure_inputs(asset_dir: Path) -> tuple[Path, Path]:
    meta_path = asset_dir / "meta.json"
    repo_dir = asset_dir / "repo"
    if not meta_path.exists():
        raise FileNotFoundError("자산 명세서 임시 저장 정보(meta.json)를 찾을 수 없습니다. 먼저 자산 명세서 작성 단계에서 다음을 눌러 저장하세요.")
    if not repo_dir.exists():
        raise FileNotFoundError("연결된 Git 저장소를 찾을 수 없습니다. 먼저 자산 연동 단계에서 저장소를 연결하세요.")
    for prompt_path in [PLAN_PROMPT_PATH, CLAUDE_PROMPT_PATH, SKILL_PROMPT_PATH]:
        if not prompt_path.exists():
            raise FileNotFoundError(f"prompt file not found: {prompt_path}")
    return meta_path, repo_dir


def plan_skill_candidates(asset_dir: Path, output_dir: Path) -> dict:
    meta_path, repo_dir = ensure_inputs(asset_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    asset_meta = read_json(meta_path)
    common = {
        "ASSET_META_JSON": json.dumps(asset_meta, ensure_ascii=False, indent=2),
        "REPO_TREE": build_tree(repo_dir),
        "REPO_FILES": collect_text_files(repo_dir),
    }
    prompt = render_template(PLAN_PROMPT_PATH, common)
    plan = validate_plan(parse_json_response(chat_completion(prompt)))
    (output_dir / "skill_plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return plan


def iter_generate_skill_package(asset_dir: Path, output_dir: Path, plan: dict, selected_skill_slugs: list[str]):
    meta_path, repo_dir = ensure_inputs(asset_dir)
    candidates = plan.get("candidates") if isinstance(plan.get("candidates"), list) else []
    # Normalize plans created before skill types were reduced to guide and skeleton.
    candidates = [
        {**candidate, "skill_type": "skeleton"}
        if isinstance(candidate, dict) and candidate.get("skill_type") == "both"
        else candidate
        for candidate in candidates
    ]
    plan = {**plan, "candidates": candidates}
    by_slug = {str(candidate.get("slug")): candidate for candidate in candidates if isinstance(candidate, dict) and candidate.get("slug")}
    selected = [by_slug[slug] for slug in selected_skill_slugs if slug in by_slug]
    if not selected:
        raise ValueError("생성할 Skill 후보를 1개 이상 선택하세요.")

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    asset_meta_json = json.dumps(read_json(meta_path), ensure_ascii=False, indent=2)
    repo_tree = build_tree(repo_dir)
    plan = {**plan, "selected_skill_slugs": [str(candidate["slug"]) for candidate in selected]}
    plan_json = json.dumps(plan, ensure_ascii=False, indent=2)
    (output_dir / "skill_plan.json").write_text(plan_json + "\n", encoding="utf-8")

    claude_prompt = render_template(CLAUDE_PROMPT_PATH, {
        "ASSET_META_JSON": asset_meta_json,
        "SKILL_PLAN_JSON": plan_json,
    })
    yield {"type": "step_started", "step_id": "claude", "label": "CLAUDE.md 생성"}
    generated_files = parse_files_response(chat_completion(claude_prompt), {"CLAUDE.md"})
    write_files(generated_files, output_dir)
    yield {"type": "step_completed", "step_id": "claude", "label": "CLAUDE.md 생성"}

    for candidate in selected:
        skill_slug = str(candidate["slug"])
        skill_label = f"{candidate.get('title') or skill_slug} 생성"
        yield {"type": "step_started", "step_id": skill_slug, "label": skill_label}
        selected_repo_files = collect_reference_text_files(repo_dir, candidate.get("reference_files") or [])
        skill_prompt = render_template(SKILL_PROMPT_PATH, {
            "ASSET_META_JSON": asset_meta_json,
            "REPO_TREE": repo_tree,
            "REPO_FILES": selected_repo_files,
            "ASSET_SUMMARY": str(plan.get("asset_summary", "")),
            "REUSABLE_PATTERNS_JSON": json.dumps(plan.get("reusable_patterns", []), ensure_ascii=False, indent=2),
            "SELECTED_SKILL_JSON": json.dumps(candidate, ensure_ascii=False, indent=2),
            "SKILL_SLUG": skill_slug,
        })
        skill_files = parse_files_response(chat_completion(skill_prompt), {"skills"})
        invalid_paths = [item["path"] for item in skill_files if Path(item["path"]).parts[:2] != ("skills", skill_slug)]
        if invalid_paths:
            raise ValueError(f"Skill output path mismatch for {skill_slug}: {invalid_paths}")
        validate_skill_files(skill_slug, skill_files)
        generated_files.extend(skill_files)
        write_files(skill_files, output_dir)
        yield {"type": "step_completed", "step_id": skill_slug, "label": skill_label}

    yield {"type": "completed", "files": generated_files}


def generate_skill_package(asset_dir: Path, output_dir: Path, plan: dict, selected_skill_slugs: list[str]) -> list[dict[str, str]]:
    generated_files: list[dict[str, str]] = []
    for event in iter_generate_skill_package(asset_dir, output_dir, plan, selected_skill_slugs):
        if event.get("type") == "completed":
            generated_files = event.get("files", [])
    return generated_files
