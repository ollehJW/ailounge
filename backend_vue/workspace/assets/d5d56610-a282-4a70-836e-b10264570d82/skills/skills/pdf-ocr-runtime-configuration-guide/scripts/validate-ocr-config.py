#!/usr/bin/env python3
"""Validate a YAML configuration for a reusable PDF OCR runtime."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover - user environment guard
    raise SystemExit("PyYAML is required. Install it with: pip install PyYAML") from exc

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

THRESHOLD_KEYS = {
    "text_det_thresh",
    "text_det_box_thresh",
    "text_rec_score_thresh",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate PDF OCR YAML configuration paths, option names, option types, and runtime profile consistency."
    )
    parser.add_argument("--config", required=True, help="Path to the OCR YAML configuration file.")
    parser.add_argument(
        "--check-files",
        action="store_true",
        help="Check whether configured input folders/files exist on this machine.",
    )
    parser.add_argument(
        "--profile",
        choices=("cpu", "gpu"),
        default=None,
        help="Expected runtime profile; reports a conflict if options.use_gpu disagrees.",
    )
    return parser.parse_args()


def add(messages: list[tuple[str, str]], level: str, text: str) -> None:
    messages.append((level, text))


def is_bool(value: Any) -> bool:
    return isinstance(value, bool)


def is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def is_float_like(value: Any) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool))


def validate_option_type(key: str, value: Any) -> bool:
    expected = OPTION_TYPES[key]
    if expected is bool:
        return is_bool(value)
    if expected is int:
        return is_int(value)
    if expected is float:
        return is_float_like(value)
    return isinstance(value, expected)


def resolve_config_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if not path.is_file():
        raise SystemExit(f"Config not found: {path}")
    return path


def load_yaml(path: Path) -> dict[str, Any]:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SystemExit(f"YAML parse error: {exc}") from exc
    if not isinstance(data, dict):
        raise SystemExit("YAML must be a mapping with either 'folder' or 'files'.")
    return data


def validate_inputs(data: dict[str, Any], base_dir: Path, check_files: bool, messages: list[tuple[str, str]]) -> list[Path]:
    has_folder = "folder" in data
    has_files = "files" in data
    if has_folder == has_files:
        add(messages, "ERROR", "Set exactly one of 'folder' or 'files'.")
        return []

    pdf_paths: list[Path] = []
    if has_folder:
        folder = (base_dir / str(data["folder"])).resolve()
        if check_files and not folder.is_dir():
            add(messages, "ERROR", f"Input folder does not exist: {folder}")
            return []
        if check_files:
            pdf_paths = sorted(folder.glob("*.pdf"))
            upper_pdf = sorted(folder.glob("*.PDF"))
            if not pdf_paths:
                add(messages, "WARNING", f"No lowercase .pdf files found in folder: {folder}")
            if upper_pdf:
                add(messages, "WARNING", "Folder mode may ignore uppercase .PDF files; rename them or use an explicit files list.")
    else:
        files = data.get("files")
        if not isinstance(files, list) or not files:
            add(messages, "ERROR", "'files' must be a non-empty list.")
            return []
        for item in files:
            path = (base_dir / str(item)).resolve()
            pdf_paths.append(path)
            if path.suffix.lower() != ".pdf":
                add(messages, "WARNING", f"Configured input does not have a .pdf extension: {path}")
            if check_files and not path.is_file():
                add(messages, "ERROR", f"Input file does not exist: {path}")
    return pdf_paths


def validate_output_dir(data: dict[str, Any], base_dir: Path, check_files: bool, messages: list[tuple[str, str]]) -> None:
    output_dir = (base_dir / str(data.get("output_dir", "outputs"))).resolve()
    parent = output_dir.parent
    if check_files and not parent.exists():
        add(messages, "WARNING", f"Output directory parent does not exist yet: {parent}")
    if output_dir.exists() and not output_dir.is_dir():
        add(messages, "ERROR", f"Output path exists but is not a directory: {output_dir}")


def validate_options(data: dict[str, Any], profile: str | None, messages: list[tuple[str, str]]) -> None:
    raw_options = data.get("options") or {}
    if not isinstance(raw_options, dict):
        add(messages, "ERROR", "'options' must be a mapping when provided.")
        return

    unknown = sorted(set(raw_options) - set(OPTION_TYPES))
    if unknown:
        add(messages, "ERROR", f"Unknown OCR options: {unknown}")

    for key, value in raw_options.items():
        if key not in OPTION_TYPES:
            continue
        if not validate_option_type(key, value):
            add(messages, "ERROR", f"Option '{key}' has invalid type; expected {OPTION_TYPES[key].__name__}.")

    dpi = raw_options.get("dpi")
    if is_int(dpi):
        if dpi < 100:
            add(messages, "WARNING", "DPI below 100 may produce weak recognition for scanned pages.")
        if dpi > 400:
            add(messages, "WARNING", "DPI above 400 can increase memory and runtime; confirm that accuracy improves.")

    cpu_threads = raw_options.get("cpu_threads")
    if cpu_threads is not None and is_int(cpu_threads) and cpu_threads < 1:
        add(messages, "ERROR", "Option 'cpu_threads' must be at least 1.")

    for key in THRESHOLD_KEYS:
        value = raw_options.get(key)
        if value is not None and is_float_like(value) and not (0.0 <= float(value) <= 1.0):
            add(messages, "ERROR", f"Option '{key}' must be between 0 and 1.")

    unclip = raw_options.get("text_det_unclip_ratio")
    if unclip is not None and is_float_like(unclip) and float(unclip) <= 0:
        add(messages, "ERROR", "Option 'text_det_unclip_ratio' must be greater than 0.")

    batch_size = raw_options.get("text_recognition_batch_size")
    if batch_size is not None and is_int(batch_size) and batch_size < 1:
        add(messages, "ERROR", "Option 'text_recognition_batch_size' must be at least 1.")

    if profile:
        configured_gpu = raw_options.get("use_gpu")
        expected_gpu = profile == "gpu"
        if configured_gpu is None:
            add(messages, "WARNING", f"Profile is {profile}, but options.use_gpu is not set explicitly.")
        elif is_bool(configured_gpu) and configured_gpu != expected_gpu:
            add(messages, "ERROR", f"Profile is {profile}, but options.use_gpu is {configured_gpu}.")


def main() -> int:
    args = parse_args()
    config_path = resolve_config_path(args.config)
    data = load_yaml(config_path)
    messages: list[tuple[str, str]] = []

    validate_inputs(data, config_path.parent, args.check_files, messages)
    validate_output_dir(data, config_path.parent, args.check_files, messages)
    validate_options(data, args.profile, messages)

    if not messages:
        print("OK: configuration passed validation.")
        return 0

    for level, text in messages:
        print(f"{level}: {text}")

    if any(level == "ERROR" for level, _ in messages):
        print("FAILED: fix errors before running OCR.")
        return 2

    print("OK WITH WARNINGS: review warnings before running OCR.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
