#!/usr/bin/env python3
# Validate a config file for the reusable audio-to-structured-document pipeline.
import argparse
import json
import sys
from pathlib import Path


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception as exc:
        print(f'Failed to read config: {exc}', file=sys.stderr)
        sys.exit(2)


def add_error(report, message):
    report['errors'].append(message)


def add_warning(report, message):
    report['warnings'].append(message)


def check_path(path_value, label, report, required=False):
    if not path_value:
        if required:
            add_error(report, f'Missing required path: {label}')
        return
    path = Path(path_value)
    if not path.exists():
        add_error(report, f'{label} does not exist: {path}')
    elif path.is_dir():
        add_error(report, f'{label} must be a file, not a directory: {path}')


def validate(cfg, check_files=False, strict=False):
    report = {'ok': True, 'errors': [], 'warnings': []}

    if not isinstance(cfg, dict):
        add_error(report, 'Config root must be a JSON object.')
        report['ok'] = False
        return report

    audio_file = cfg.get('audio_file')
    if not audio_file:
        add_error(report, 'Missing audio_file.')
    elif check_files:
        check_path(audio_file, 'audio_file', report, required=True)

    metadata = cfg.get('metadata')
    if not isinstance(metadata, dict) or not metadata:
        add_error(report, 'metadata must be a non-empty object.')
    else:
        for key in ['title', 'purpose']:
            if not metadata.get(key):
                add_warning(report, f'metadata.{key} is recommended for better correction and document generation.')

    speakers = cfg.get('speaker_candidates')
    if not isinstance(speakers, list) or not speakers:
        add_error(report, 'speaker_candidates must be a non-empty list.')
    elif any(not isinstance(item, str) or not item.strip() for item in speakers):
        add_error(report, 'Every speaker candidate must be a non-empty string.')
    elif len(set(speakers)) != len(speakers):
        add_warning(report, 'speaker_candidates contains duplicate labels.')

    model_settings = cfg.get('model_settings')
    if not isinstance(model_settings, dict):
        add_error(report, 'model_settings must be an object describing STT, diarization, and LLM adapters.')
    elif strict:
        for key in ['stt', 'diarization', 'llm']:
            if key not in model_settings:
                add_error(report, f'model_settings.{key} is required in strict mode.')

    document = cfg.get('document')
    sections = document.get('sections') if isinstance(document, dict) else None
    if not isinstance(sections, list) or not sections:
        add_error(report, 'document.sections must be a non-empty list.')
    elif any(not isinstance(item, str) or not item.strip() for item in sections):
        add_error(report, 'Every document section must be a non-empty string.')

    reference_files = cfg.get('reference_files', [])
    if reference_files and not isinstance(reference_files, list):
        add_error(report, 'reference_files must be a list when provided.')
    elif check_files:
        for index, path_value in enumerate(reference_files, start=1):
            check_path(path_value, f'reference_files[{index}]', report)

    input_paths = cfg.get('input_paths', {})
    if input_paths and not isinstance(input_paths, dict):
        add_error(report, 'input_paths must be an object when provided.')
    elif check_files:
        for key in ['diarization_segments', 'stt_sentences', 'stt_corrections', 'speaker_matches', 'generated_document']:
            if key in input_paths:
                check_path(input_paths.get(key), f'input_paths.{key}', report)

    processing = cfg.get('processing', {})
    if processing and not isinstance(processing, dict):
        add_error(report, 'processing must be an object when provided.')
    elif isinstance(processing, dict):
        for key in ['max_merge_silence_s', 'min_segment_duration_s', 'max_stt_segment_duration_s']:
            if key in processing and not isinstance(processing[key], (int, float)):
                add_error(report, f'processing.{key} must be numeric.')

    report['ok'] = not report['errors']
    return report


def main():
    parser = argparse.ArgumentParser(description='Validate audio document pipeline configuration.')
    parser.add_argument('--config', required=True, help='Path to the JSON configuration file.')
    parser.add_argument('--check-files', action='store_true', help='Verify that declared local input files exist.')
    parser.add_argument('--strict', action='store_true', help='Require explicit STT, diarization, and LLM model settings.')
    args = parser.parse_args()

    cfg = load_json(args.config)
    report = validate(cfg, check_files=args.check_files, strict=args.strict)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report['ok'] else 1)


if __name__ == '__main__':
    main()
