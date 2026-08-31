#!/usr/bin/env python3
"""Generate a grounded structured Markdown report from speaker/time/content utterance JSON."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from string import Formatter
from typing import Any

ALLOWED_PLACEHOLDERS = {"transcript_text", "instruction_block", "section_block"}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def normalize_sentences(payload: Any) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    if isinstance(payload, dict):
        sentences = payload.get("sentences", [])
    else:
        sentences = payload

    if not isinstance(sentences, list):
        raise ValueError("Input JSON must be a list or an object containing a 'sentences' list.")

    normalized: list[dict[str, Any]] = []
    for position, item in enumerate(sentences, start=1):
        if not isinstance(item, dict):
            warnings.append(f"Skipped item {position}: expected an object.")
            continue

        content = str(item.get("content", "")).strip()
        if not content:
            warnings.append(f"Skipped item {position}: empty content.")
            continue

        index = item.get("index", len(normalized) + 1)
        speaker = item.get("speaker", item.get("speaker_id", "Unknown"))
        time_value = item.get("time")
        if not time_value and "start" in item and "end" in item:
            try:
                time_value = f"{float(item['start']):.1f}s - {float(item['end']):.1f}s"
            except (TypeError, ValueError):
                time_value = ""
        if not time_value:
            warnings.append(f"Item {position} has no time field; continuing without time trace.")
            time_value = ""

        normalized.append({
            "index": index,
            "speaker": str(speaker),
            "time": str(time_value),
            "content": content,
        })

    if not normalized:
        raise ValueError("No usable utterances were found after normalization.")
    return normalized, warnings


def format_transcript(sentences: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for sentence in sentences:
        index = sentence.get("index", "")
        speaker = sentence.get("speaker", "Unknown")
        time_value = sentence.get("time", "")
        content = sentence.get("content", "").strip()
        if time_value:
            lines.append(f"[{index}] {speaker} ({time_value}): {content}")
        else:
            lines.append(f"[{index}] {speaker}: {content}")
    return "\n".join(lines)


def load_sections(path: Path) -> tuple[list[str], str]:
    payload = read_json(path)
    sections = payload.get("sections") if isinstance(payload, dict) else payload
    if not isinstance(sections, list) or not sections:
        raise ValueError("Sections JSON must be a non-empty list or an object with a non-empty 'sections' list.")

    headings: list[str] = []
    lines: list[str] = []
    for position, section in enumerate(sections, start=1):
        if isinstance(section, str):
            heading = section.strip()
            description = ""
        elif isinstance(section, dict):
            heading = str(section.get("heading") or section.get("title") or section.get("name") or "").strip()
            description = str(section.get("description") or section.get("rules") or "").strip()
        else:
            raise ValueError(f"Section {position} must be a string or object.")

        if not heading:
            raise ValueError(f"Section {position} is missing a heading/title/name.")
        headings.append(heading)
        lines.append(f"- {heading}" + (f": {description}" if description else ""))

    return headings, "\n".join(lines)


def validate_prompt_template(template: str) -> list[str]:
    found = {field_name for _, field_name, _, _ in Formatter().parse(template) if field_name}
    unknown = found - ALLOWED_PLACEHOLDERS
    missing = {"transcript_text", "instruction_block"} - found
    errors: list[str] = []
    if unknown:
        errors.append("Unsupported prompt placeholders: " + ", ".join(sorted(unknown)))
    if missing:
        errors.append("Missing required prompt placeholders: " + ", ".join(sorted(missing)))
    return errors


def build_prompt(template: str, transcript_text: str, instruction: str, section_block: str) -> str:
    errors = validate_prompt_template(template)
    if errors:
        raise ValueError("; ".join(errors))
    try:
        return template.format(
            transcript_text=transcript_text,
            instruction_block=instruction.strip() or "None",
            section_block=section_block,
        )
    except KeyError as exc:
        raise ValueError(f"Unsupported prompt placeholder: {exc}") from exc
    except ValueError as exc:
        raise ValueError("Prompt formatting failed. Escape literal braces as '{{' and '}}'.") from exc


def create_client(provider: str):
    try:
        from openai import AzureOpenAI, OpenAI
    except ImportError as exc:
        raise RuntimeError("The 'openai' package is required for LLM calls. Install it with: pip install openai") from exc

    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "")
    api_version = os.getenv("OPENAI_API_VERSION", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for LLM calls.")

    if provider == "azure":
        if not base_url:
            raise RuntimeError("OPENAI_BASE_URL is required when --provider azure is used.")
        if not api_version:
            raise RuntimeError("OPENAI_API_VERSION is required when --provider azure is used.")
        return AzureOpenAI(azure_endpoint=base_url, api_key=api_key, api_version=api_version)

    kwargs: dict[str, Any] = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs)


def call_llm(prompt: str, provider: str | None, temperature: float) -> str:
    model = os.getenv("OPENAI_MODEL", "")
    if not model:
        raise RuntimeError("OPENAI_MODEL is required for LLM calls.")

    selected_provider = provider or os.getenv("LLM_PROVIDER") or ("azure" if os.getenv("OPENAI_API_VERSION") else "openai")
    if selected_provider not in {"azure", "openai"}:
        raise RuntimeError("Provider must be 'azure' or 'openai'.")

    client = create_client(selected_provider)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    content = response.choices[0].message.content if response.choices else ""
    content = (content or "").strip()
    if not content:
        raise RuntimeError("LLM returned an empty response.")
    return content


def validate_markdown(markdown: str, headings: list[str]) -> dict[str, Any]:
    warnings: list[str] = []
    stripped = markdown.strip()
    if not stripped:
        warnings.append("Generated Markdown is empty.")
    if stripped.startswith("```") or stripped.endswith("```"):
        warnings.append("Generated Markdown appears to be wrapped in a code fence.")

    missing_headings = []
    lower_markdown = markdown.lower()
    for heading in headings:
        heading_lower = heading.lower()
        if f"## {heading_lower}" not in lower_markdown and f"### {heading_lower}" not in lower_markdown:
            missing_headings.append(heading)
    if missing_headings:
        warnings.append("Missing expected section headings: " + ", ".join(missing_headings))

    for heading in headings:
        if "action" in heading.lower() and "|" not in markdown:
            warnings.append("An action-item section was requested, but no Markdown table was detected.")
            break

    return {"ok": not warnings, "warnings": warnings, "missing_headings": missing_headings}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a grounded Markdown report from utterance JSON.")
    parser.add_argument("--input-json", required=True, help="Path to corrected utterance JSON.")
    parser.add_argument("--prompt-template", required=True, help="Path to a text prompt template.")
    parser.add_argument("--sections-json", required=True, help="Path to required section definitions JSON.")
    parser.add_argument("--output-md", required=True, help="Path where the generated Markdown report will be written.")
    parser.add_argument("--special-instruction", default="", help="Optional user instruction to inject into the prompt.")
    parser.add_argument("--env-file", default=".env", help="Optional environment file path. Default: .env")
    parser.add_argument("--provider", choices=["azure", "openai"], default=None, help="LLM provider mode. Default: infer from environment.")
    parser.add_argument("--temperature", type=float, default=0.0, help="LLM sampling temperature. Default: 0.0")
    parser.add_argument("--prompt-output", default="", help="Optional path for writing the rendered prompt.")
    parser.add_argument("--validation-json", default="", help="Optional path for the validation report JSON.")
    parser.add_argument("--dry-run", action="store_true", help="Render and save the prompt without calling the LLM.")
    parser.add_argument("--validate-only", action="store_true", help="Validate inputs and template without rendering output or calling the LLM.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(Path(args.env_file))

    input_path = Path(args.input_json)
    prompt_template_path = Path(args.prompt_template)
    sections_path = Path(args.sections_json)
    output_path = Path(args.output_md)

    sentences, input_warnings = normalize_sentences(read_json(input_path))
    headings, section_block = load_sections(sections_path)
    template = prompt_template_path.read_text(encoding="utf-8")
    template_errors = validate_prompt_template(template)
    if template_errors:
        raise ValueError("; ".join(template_errors))

    transcript_text = format_transcript(sentences)
    print(f"Validated {len(sentences)} utterances from {input_path}.")
    for warning in input_warnings:
        print(f"Warning: {warning}", file=sys.stderr)

    if args.validate_only:
        print("Validation completed without calling the LLM.")
        return 0

    prompt = build_prompt(template, transcript_text, args.special_instruction, section_block)

    if args.dry_run:
        prompt_output = Path(args.prompt_output) if args.prompt_output else output_path.with_suffix(".prompt.txt")
        prompt_output.parent.mkdir(parents=True, exist_ok=True)
        prompt_output.write_text(prompt, encoding="utf-8")
        print(f"Rendered prompt written to {prompt_output}. LLM call skipped.")
        return 0

    markdown = call_llm(prompt, args.provider, args.temperature)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown + "\n", encoding="utf-8")

    validation = validate_markdown(markdown, headings)
    validation_path = Path(args.validation_json) if args.validation_json else output_path.with_suffix(output_path.suffix + ".validation.json")
    validation_path.write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Generated Markdown report: {output_path}")
    print(f"Validation report: {validation_path}")
    if validation["warnings"]:
        for warning in validation["warnings"]:
            print(f"Warning: {warning}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
