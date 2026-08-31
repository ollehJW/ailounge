#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def sample_config() -> dict:
    return {
        'runtime': {
            'device': 'auto',
            'transformers_offline': False,
            'env_file': '.env'
        },
        'diarization': {
            'model': 'pyannote/speaker-diarization-community-1',
            'token_env': 'HF_TOKEN'
        },
        'asr': {
            'provider': 'qwen_asr',
            'model_path': './asr-model',
            'language': 'Korean',
            'batch_size': 8,
            'max_new_tokens': 512
        },
        'segmentation': {
            'max_merge_silence_s': 10.0,
            'min_segment_duration_s': 1.5,
            'max_stt_segment_duration_s': 30.0,
            'low_energy_search_window_s': 5.0
        },
        'llm': {
            'provider': 'azure_openai',
            'api_key_env': 'OPENAI_API_KEY',
            'base_url_env': 'OPENAI_BASE_URL',
            'api_version_env': 'OPENAI_API_VERSION',
            'api_version_default': '2025-04-01-preview',
            'model_env': 'OPENAI_MODEL',
            'model_default': 'gpt-4.1'
        },
        'postprocess': {
            'correction_batch_size': 50
        }
    }


def read_text_or_literal(value: str | None) -> str:
    if not value:
        return ''
    path = Path(value)
    if path.exists():
        return path.read_text(encoding='utf-8').strip()
    return value.strip()


def require_path(data: dict, dotted: str, errors: list[str]):
    current = data
    for part in dotted.split('.'):
        if not isinstance(current, dict) or part not in current:
            errors.append(f'Missing required config key: {dotted}')
            return None
        current = current[part]
    if current in (None, ''):
        errors.append(f'Empty required config key: {dotted}')
    return current


def main() -> int:
    parser = argparse.ArgumentParser(description='Validate configuration for the audio transcript pipeline.')
    parser.add_argument('--config', help='Path to the pipeline JSON config.')
    parser.add_argument('--audio', help='Audio file path to validate.')
    parser.add_argument('--participants', help='Participant list text or a path to a text file.')
    parser.add_argument('--write-sample', help='Write a sample config JSON to this path and exit.')
    args = parser.parse_args()

    if args.write_sample:
        target = Path(args.write_sample)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(sample_config(), ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'Wrote sample config: {target}')
        return 0

    errors: list[str] = []
    warnings: list[str] = []

    if not args.config:
        errors.append('Missing --config.')
    else:
        config_path = Path(args.config)
        if not config_path.exists():
            errors.append(f'Config file does not exist: {config_path}')
            config = {}
        else:
            try:
                config = json.loads(config_path.read_text(encoding='utf-8'))
            except Exception as exc:
                errors.append(f'Config is not valid JSON: {exc}')
                config = {}

        if config:
            for key in [
                'diarization.model',
                'asr.provider',
                'asr.model_path',
                'asr.batch_size',
                'segmentation.max_merge_silence_s',
                'segmentation.min_segment_duration_s',
                'segmentation.max_stt_segment_duration_s',
                'llm.provider',
                'postprocess.correction_batch_size'
            ]:
                require_path(config, key, errors)

            llm = config.get('llm', {})
            for env_key_name in ['api_key_env', 'base_url_env']:
                env_name = llm.get(env_key_name)
                if env_name and not os.getenv(env_name):
                    warnings.append(f'Environment variable is not set: {env_name}')

            token_env = config.get('diarization', {}).get('token_env')
            model = str(config.get('diarization', {}).get('model', ''))
            if token_env and not os.getenv(token_env) and not Path(model).exists():
                warnings.append(f'Diarization token environment variable is not set: {token_env}')

    if args.audio and not Path(args.audio).exists():
        errors.append(f'Audio file does not exist: {args.audio}')

    participants = read_text_or_literal(args.participants)
    if args.participants and not participants:
        errors.append('Participant list is empty.')

    for warning in warnings:
        print(f'WARN: {warning}')
    if errors:
        for error in errors:
            print(f'ERROR: {error}')
        return 1

    print('Validation completed successfully.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
