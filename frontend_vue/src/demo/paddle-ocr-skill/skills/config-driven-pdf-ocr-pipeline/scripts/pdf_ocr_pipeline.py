#!/usr/bin/env python3
"""Config-driven batch OCR for image-based PDF documents."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import warnings
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover - dependency guidance path
    raise SystemExit("Missing dependency: install PyYAML before running this script.") from exc

log = logging.getLogger("pdf_ocr_pipeline")

OPTION_TYPES: dict[str, type] = {
    "lang": str,
    "dpi": int,
    "use_gpu": bool,
    "use_doc_orientation_classify": bool,
    "use_doc_unwarping": bool,
    "use_textline_orientation": bool,
    "enable_mkldnn": bool,
    "cpu_threads": int,
    "text_det_limit_side_len": int,
    "text_det_limit_type": str,
    "text_det_thresh": float,
    "text_det_box_thresh": float,
    "text_det_unclip_ratio": float,
    "text_rec_score_thresh": float,
    "text_recognition_batch_size": int,
}

DEFAULT_OPTIONS: dict[str, Any] = {
    "lang": "en",
    "dpi": 200,
    "use_gpu": False,
    "use_doc_orientation_classify": False,
    "use_doc_unwarping": False,
    "use_textline_orientation": False,
    "enable_mkldnn": False,
    "cpu_threads": 4,
}

TRUE_VALUES = {"1", "true", "yes", "y", "on"}
FALSE_VALUES = {"0", "false", "no", "n", "off"}


def patch_ld_library_path() -> None:
    """Expose GPU libraries bundled in a virtual environment before OCR imports."""
    if os.environ.get("_NVIDIA_LD_PATCHED"):
        return
    site_packages = next((path for path in sys.path if "site-packages" in path), None)
    if not site_packages:
        return
    nvidia_dir = Path(site_packages) / "nvidia"
    library_dirs = sorted(str(path) for path in nvidia_dir.glob("*/lib") if path.is_dir())
    if not library_dirs:
        return
    existing = os.environ.get("LD_LIBRARY_PATH", "")
    os.environ["LD_LIBRARY_PATH"] = ":".join(library_dirs + ([existing] if existing else []))
    os.environ["_NVIDIA_LD_PATCHED"] = "1"
    os.execv(sys.executable, [sys.executable, *sys.argv])


def coerce_value(key: str, value: Any) -> Any:
    """Coerce YAML values to the option type expected by the OCR engine."""
    expected = OPTION_TYPES[key]
    if expected is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in TRUE_VALUES:
                return True
            if lowered in FALSE_VALUES:
                return False
        raise ValueError(f"Option '{key}' must be a boolean value.")
    try:
        return expected(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Option '{key}' must be {expected.__name__}: {value!r}") from exc


def read_yaml(config_path: Path) -> dict[str, Any]:
    """Read and validate the top-level YAML structure."""
    if not config_path.is_file():
        raise FileNotFoundError(f"Config not found: {config_path}")
    data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("YAML must be a mapping.")
    return data


def resolve_pdf_inputs(data: dict[str, Any], base_dir: Path) -> list[Path]:
    """Resolve either a folder of PDFs or an explicit PDF file list."""
    has_folder = "folder" in data
    has_files = "files" in data
    if has_folder == has_files:
        raise ValueError("Set exactly one input mode: 'folder' or 'files'.")

    if has_folder:
        source_dir = (base_dir / str(data["folder"])).resolve()
        if not source_dir.is_dir():
            raise FileNotFoundError(f"Input folder not found: {source_dir}")
        pdf_paths = sorted(path.resolve() for path in source_dir.iterdir() if path.suffix.lower() == ".pdf")
    else:
        if not isinstance(data["files"], list) or not data["files"]:
            raise ValueError("'files' must be a non-empty list of PDF paths.")
        pdf_paths = [(base_dir / str(item)).resolve() for item in data["files"]]

    if not pdf_paths:
        raise ValueError("No PDF files were found.")
    for pdf_path in pdf_paths:
        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError(f"Input is not a PDF: {pdf_path}")
        if not pdf_path.is_file():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
    return pdf_paths


def resolve_options(data: dict[str, Any]) -> dict[str, Any]:
    """Validate OCR option names and coerce values."""
    raw_options = data.get("options") or {}
    if not isinstance(raw_options, dict):
        raise ValueError("'options' must be a mapping when provided.")
    unknown = sorted(set(raw_options) - set(OPTION_TYPES))
    if unknown:
        raise ValueError(f"Unknown OCR option(s): {unknown}")
    options = dict(DEFAULT_OPTIONS)
    for key, value in raw_options.items():
        options[key] = coerce_value(key, value)
    return options


def ensure_inside_directory(path: Path, directory: Path) -> None:
    """Prevent output templates from escaping the configured output directory."""
    try:
        path.relative_to(directory)
    except ValueError as exc:
        raise ValueError(f"Output path escapes output_dir: {path}") from exc


def output_path_for(pdf_path: Path, index: int, output_dir: Path, template: str) -> Path:
    """Render the output file path for one PDF."""
    rendered = template.format(stem=pdf_path.stem, name=pdf_path.name, index=index)
    candidate = (output_dir / rendered).resolve()
    ensure_inside_directory(candidate, output_dir)
    if candidate.suffix.lower() != ".txt":
        candidate = candidate.with_suffix(".txt")
    return candidate


def load_config(config_path: Path) -> tuple[list[Path], Path, str, dict[str, Any], bool]:
    """Load input paths, output policy, options, and failure behavior."""
    data = read_yaml(config_path)
    allowed_top_level = {"folder", "files", "output_dir", "output_template", "options", "continue_on_error"}
    unknown_top_level = sorted(set(data) - allowed_top_level)
    if unknown_top_level:
        raise ValueError(f"Unknown top-level config key(s): {unknown_top_level}")

    base_dir = config_path.parent
    pdf_paths = resolve_pdf_inputs(data, base_dir)
    output_dir = (base_dir / str(data.get("output_dir", "outputs"))).resolve()
    output_template = str(data.get("output_template", "{stem}.txt"))
    options = resolve_options(data)
    continue_on_error = coerce_value("use_gpu", data.get("continue_on_error", False))

    for index, pdf_path in enumerate(pdf_paths, start=1):
        output_path_for(pdf_path, index, output_dir, output_template)
    return pdf_paths, output_dir, output_template, options, continue_on_error


def import_ocr_dependencies() -> tuple[Any, Any, Any]:
    """Import heavy OCR dependencies only when OCR execution is requested."""
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    warnings.filterwarnings("ignore", message="No ccache found", category=UserWarning)
    patch_ld_library_path()
    try:
        import fitz
        import numpy as np
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise SystemExit(
            "Missing OCR runtime dependency. Install the PDF rendering, numeric array, OCR engine, "
            "and CPU/GPU compute packages required by this pipeline."
        ) from exc
    return fitz, np, PaddleOCR


def build_ocr_engine(options: dict[str, Any]) -> Any:
    """Create an OCR engine with configured runtime and recognition options."""
    _, _, engine_class = import_ocr_dependencies()
    optional = {
        key: value
        for key, value in options.items()
        if key not in DEFAULT_OPTIONS and value is not None
    }
    return engine_class(
        lang=options["lang"],
        device="gpu" if options["use_gpu"] else "cpu",
        use_doc_orientation_classify=options["use_doc_orientation_classify"],
        use_doc_unwarping=options["use_doc_unwarping"],
        use_textline_orientation=options["use_textline_orientation"],
        enable_mkldnn=options["enable_mkldnn"],
        cpu_threads=options["cpu_threads"],
        **optional,
    )


def extract_lines(page_result: Any) -> list[str]:
    """Normalize OCR output into clean text lines."""
    if isinstance(page_result, dict):
        if isinstance(page_result.get("rec_texts"), list):
            return [str(text).strip() for text in page_result["rec_texts"] if str(text).strip()]
        nested = page_result.get("res")
        if isinstance(nested, dict) and isinstance(nested.get("rec_texts"), list):
            return [str(text).strip() for text in nested["rec_texts"] if str(text).strip()]
    return []


def extract_text_from_pdf(pdf_path: Path, options: dict[str, Any]) -> tuple[str, int, int]:
    """Render each PDF page, run OCR, and return page-separated text."""
    fitz, np, _ = import_ocr_dependencies()
    ocr = build_ocr_engine(options)
    matrix = fitz.Matrix(options["dpi"] / 72.0, options["dpi"] / 72.0)
    page_texts: list[str] = []

    with fitz.open(pdf_path) as document:
        page_count = len(document)
        for page_index, page in enumerate(document, start=1):
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
                pixmap.height, pixmap.width, pixmap.n
            )
            result = ocr.predict(
                image,
                use_doc_orientation_classify=options["use_doc_orientation_classify"],
                use_doc_unwarping=options["use_doc_unwarping"],
                use_textline_orientation=options["use_textline_orientation"],
            )
            page_result = result[0] if isinstance(result, list) and result else result
            lines = extract_lines(page_result)
            page_texts.append(f"=== Page {page_index} ===\n" + "\n".join(lines))

    text = "\n\n".join(page_texts).rstrip() + "\n"
    return text, page_count, len(text.strip())


def process_batch(
    pdf_paths: list[Path],
    output_dir: Path,
    output_template: str,
    options: dict[str, Any],
    continue_on_error: bool,
) -> list[dict[str, Any]]:
    """Process all PDFs and return a manifest of successes and failures."""
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, Any]] = []
    for index, pdf_path in enumerate(pdf_paths, start=1):
        started = time.time()
        txt_path = output_path_for(pdf_path, index, output_dir, output_template)
        record: dict[str, Any] = {
            "input_pdf": str(pdf_path),
            "output_txt": str(txt_path),
            "status": "started",
            "pages": 0,
            "characters": 0,
            "seconds": 0.0,
            "error": None,
        }
        try:
            log.info("OCR start: %s", pdf_path.name)
            text, pages, characters = extract_text_from_pdf(pdf_path, options)
            txt_path.parent.mkdir(parents=True, exist_ok=True)
            txt_path.write_text(text, encoding="utf-8")
            record.update(status="ok", pages=pages, characters=characters)
            log.info("OCR done: %s", txt_path)
        except Exception as exc:  # noqa: BLE001 - batch manifest should capture file-level failures
            record.update(status="error", error=str(exc))
            log.exception("OCR failed: %s", pdf_path)
            if not continue_on_error:
                record["seconds"] = round(time.time() - started, 3)
                manifest.append(record)
                write_manifest(output_dir, manifest)
                raise
        finally:
            record["seconds"] = round(time.time() - started, 3)
        manifest.append(record)
    write_manifest(output_dir, manifest)
    return manifest


def write_manifest(output_dir: Path, manifest: list[dict[str, Any]]) -> None:
    """Write a JSON manifest for output validation and rerun planning."""
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "ocr_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a YAML-configured PDF OCR batch pipeline.")
    parser.add_argument("--config", required=True, help="Path to the YAML configuration file.")
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Validate configuration and input/output paths without running OCR.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level), format="%(asctime)s [%(levelname)s] %(message)s")
    config_path = Path(args.config).resolve()
    pdf_paths, output_dir, output_template, options, continue_on_error = load_config(config_path)

    if args.check_only:
        print(json.dumps({
            "status": "valid",
            "pdf_count": len(pdf_paths),
            "output_dir": str(output_dir),
            "output_template": output_template,
            "continue_on_error": continue_on_error,
            "options": options,
        }, ensure_ascii=False, indent=2))
        return

    manifest = process_batch(pdf_paths, output_dir, output_template, options, continue_on_error)
    failures = [item for item in manifest if item["status"] != "ok"]
    if failures:
        raise SystemExit(f"OCR completed with {len(failures)} failed file(s). See {output_dir / 'ocr_manifest.json'}")
    log.info("OCR completed successfully for %d PDF(s).", len(manifest))


if __name__ == "__main__":
    main()
