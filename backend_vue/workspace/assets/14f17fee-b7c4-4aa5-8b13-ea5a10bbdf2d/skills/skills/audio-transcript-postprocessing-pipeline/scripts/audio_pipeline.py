#!/usr/bin/env python3
'''
Config-driven audio transcript postprocessing skeleton.
It runs diarization, segment cleanup, STT, conservative LLM correction, and speaker matching.
'''
from __future__ import annotations

import argparse
import gc
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

DEFAULT_CONFIG = {
    'env_file': '.env',
    'audio': {
        'language': 'Korean',
        'max_merge_silence_s': 10.0,
        'min_segment_duration_s': 1.5,
        'max_stt_segment_duration_s': 30.0,
        'split_search_window_s': 5.0
    },
    'stt': {
        'model_path': './qwen3-asr-1.7b',
        'batch_size': 8,
        'max_new_tokens': 512
    },
    'diarization': {
        'model_id': 'pyannote/speaker-diarization-community-1',
        'token_env': 'HF_TOKEN'
    },
    'llm': {
        'enabled': True,
        'provider': 'azure_openai',
        'api_key_env': 'OPENAI_API_KEY',
        'base_url_env': 'OPENAI_BASE_URL',
        'api_version_env': 'OPENAI_API_VERSION',
        'api_version_default': '2025-04-01-preview',
        'model_env': 'OPENAI_MODEL',
        'model_default': 'gpt-4o-mini',
        'correction_batch_size': 50
    }
}


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def load_env_file(path: str | Path | None) -> None:
    if not path:
        return
    env_path = Path(path)
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_config(path: str | None) -> dict[str, Any]:
    config = DEFAULT_CONFIG
    if path:
        with Path(path).open(encoding='utf-8') as f:
            config = deep_merge(config, json.load(f))
    load_env_file(config.get('env_file'))
    return config


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def read_text_or_value(value: str | None) -> str:
    if not value:
        return ''
    candidate = Path(value)
    if candidate.exists() and candidate.is_file():
        return candidate.read_text(encoding='utf-8').strip()
    return value.strip()


def participant_list(value: str) -> str:
    text = read_text_or_value(value)
    parts = [p.strip() for p in re.split(r'[,\n;]+', text) if p.strip()]
    return '\n'.join(parts)


def elapsed(start: float) -> str:
    return f'{time.time() - start:.1f}s'


def progress(stage: str, percent: int, message: str) -> None:
    print(json.dumps({'stage': stage, 'percent': percent, 'message': message}, ensure_ascii=False), flush=True)


def format_time_range(start_s: float, end_s: float) -> str:
    return f'{start_s:.1f}s - {end_s:.1f}s'


def merge_consecutive_speaker_segments(segments: list[dict[str, Any]], max_silence_s: float) -> list[dict[str, Any]]:
    if not segments:
        return []
    sorted_segments = sorted(segments, key=lambda s: s['start'])
    merged = []
    current = dict(sorted_segments[0])
    for segment in sorted_segments[1:]:
        silence_s = segment['start'] - current['end']
        if segment['speaker'] == current['speaker'] and silence_s < max_silence_s:
            current['end'] = max(current['end'], segment['end'])
        else:
            merged.append(current)
            current = dict(segment)
    merged.append(current)
    return merged


def drop_short_segments(segments: list[dict[str, Any]], min_duration_s: float) -> list[dict[str, Any]]:
    return [s for s in segments if s['end'] - s['start'] >= min_duration_s]


def fix_overlapping_segments(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not segments:
        return []
    result = [dict(segments[0])]
    for segment in segments[1:]:
        prev = result[-1]
        fixed = dict(segment)
        if fixed['start'] < prev['end']:
            fixed['start'] = prev['end'] + 0.1
        if fixed['end'] <= fixed['start']:
            fixed['end'] = fixed['start'] + 0.1
        result.append(fixed)
    return result


def preprocess_speaker_segments(segments: list[dict[str, Any]], max_silence_s: float, min_duration_s: float) -> dict[str, Any]:
    first = merge_consecutive_speaker_segments(segments, max_silence_s)
    filtered = drop_short_segments(first, min_duration_s)
    second = merge_consecutive_speaker_segments(filtered, max_silence_s)
    fixed = fix_overlapping_segments(second)
    final_filtered = drop_short_segments(fixed, min_duration_s)
    final = merge_consecutive_speaker_segments(final_filtered, max_silence_s)
    return {'first_merged': first, 'filtered': filtered, 'second_merged': second, 'overlap_fixed': fixed, 'final_filtered': final_filtered, 'final': final}


def find_low_energy_split_time(mono_waveform: Any, sample_rate: int, search_start_s: float, search_end_s: float, frame_s: float = 0.2, hop_s: float = 0.05) -> float:
    import torch
    search_start_sample = max(0, int(search_start_s * sample_rate))
    search_end_sample = min(mono_waveform.shape[0], int(search_end_s * sample_rate))
    frame_samples = max(1, int(frame_s * sample_rate))
    hop_samples = max(1, int(hop_s * sample_rate))
    if search_end_sample - search_start_sample < frame_samples:
        return search_end_s
    best_energy = None
    best_start_sample = search_start_sample
    for frame_start in range(search_start_sample, search_end_sample - frame_samples + 1, hop_samples):
        frame = mono_waveform[frame_start:frame_start + frame_samples]
        energy = float(torch.mean(frame.float() ** 2).item())
        if best_energy is None or energy < best_energy:
            best_energy = energy
            best_start_sample = frame_start
    return (best_start_sample + frame_samples // 2) / sample_rate


def split_long_speaker_segments(segments: list[dict[str, Any]], max_duration_s: float, mono_waveform: Any, sample_rate: int, search_window_s: float, min_chunk_s: float) -> list[dict[str, Any]]:
    if not max_duration_s or max_duration_s <= 0:
        return [dict(s) for s in segments]
    output = []
    for segment in segments:
        start = segment['start']
        end = segment['end']
        if end - start <= max_duration_s:
            output.append(dict(segment))
            continue
        current_start = start
        while end - current_start > max_duration_s:
            target_end = current_start + max_duration_s
            search_start = max(current_start + min_chunk_s, target_end - search_window_s)
            search_end = min(target_end, end)
            split_time = find_low_energy_split_time(mono_waveform, sample_rate, search_start, search_end)
            if split_time <= current_start + min_chunk_s or split_time > target_end:
                split_time = target_end
            chunk = dict(segment)
            chunk['start'] = current_start
            chunk['end'] = split_time
            output.append(chunk)
            current_start = split_time
        if end - current_start >= min_chunk_s:
            chunk = dict(segment)
            chunk['start'] = current_start
            chunk['end'] = end
            output.append(chunk)
        elif output:
            output[-1]['end'] = end
    return output


def build_segment_audio(segment: dict[str, Any], mono_waveform: Any, sample_rate: int) -> tuple[Any, int] | None:
    start_sample = max(0, int(segment['start'] * sample_rate))
    end_sample = min(mono_waveform.shape[0], int(segment['end'] * sample_rate))
    if end_sample <= start_sample:
        return None
    return mono_waveform[start_sample:end_sample].cpu().numpy(), sample_rate


def get_transcript_text(result: Any) -> str:
    if hasattr(result, 'text'):
        return str(result.text).strip()
    if isinstance(result, dict):
        return str(result.get('text', '')).strip()
    return str(result).strip()


def transcribe_audio(audio_path: Path, output_dir: Path, config: dict[str, Any]) -> dict[str, Any]:
    import torch
    import torchaudio
    from pyannote.audio import Pipeline
    from qwen_asr import Qwen3ASRModel

    waveform = mono_waveform = None
    diarization_pipeline = stt_model = None
    try:
        audio_cfg = config['audio']
        stt_cfg = config['stt']
        diar_cfg = config['diarization']
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        device_map = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        torch_dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32

        progress('loading', 5, 'Loading audio')
        start = time.time()
        waveform, sample_rate = torchaudio.load(str(audio_path))
        audio_length = waveform.shape[1] / sample_rate
        mono_waveform = waveform.mean(dim=0)
        progress('loading', 8, f'Audio loaded: {audio_length:.1f}s in {elapsed(start)}')

        token = os.getenv(diar_cfg.get('token_env', 'HF_TOKEN')) or os.getenv('HUGGINGFACE_HUB_TOKEN')
        if not token and not Path(diar_cfg['model_id']).exists():
            raise RuntimeError('Diarization token is required unless the configured model path is local and accessible')
        progress('diarization', 12, 'Loading diarization model')
        diarization_pipeline = Pipeline.from_pretrained(diar_cfg['model_id'], token=token)
        diarization_pipeline.to(device)
        progress('diarization', 20, 'Running diarization')
        diarization = diarization_pipeline({'waveform': waveform, 'sample_rate': sample_rate})
        raw_segments = [{'start': turn.start, 'end': turn.end, 'speaker': speaker} for turn, _, speaker in diarization.speaker_diarization.itertracks(yield_label=True)]
        speaker_ids = sorted({s['speaker'] for s in raw_segments})
        speaker_map = {speaker: index for index, speaker in enumerate(speaker_ids)}
        cleaned = preprocess_speaker_segments(raw_segments, float(audio_cfg['max_merge_silence_s']), float(audio_cfg['min_segment_duration_s']))
        progress('diarization', 30, 'Diarization cleaned from {} to {} segments'.format(len(raw_segments), len(cleaned['final'])))

        progress('stt', 35, 'Loading STT model')
        stt_model = Qwen3ASRModel.from_pretrained(
            stt_cfg['model_path'],
            dtype=torch_dtype,
            device_map=device_map,
            max_inference_batch_size=int(stt_cfg['batch_size']),
            max_new_tokens=int(stt_cfg.get('max_new_tokens', 512))
        )
        for candidate in (stt_model, getattr(stt_model, 'model', None)):
            generation_config = getattr(candidate, 'generation_config', None)
            if generation_config is not None and getattr(generation_config, 'pad_token_id', None) is None:
                eos_token_id = getattr(generation_config, 'eos_token_id', None)
                generation_config.pad_token_id = eos_token_id[0] if isinstance(eos_token_id, list) else eos_token_id

        stt_segments = split_long_speaker_segments(
            cleaned['final'],
            float(audio_cfg['max_stt_segment_duration_s']),
            mono_waveform,
            sample_rate,
            float(audio_cfg.get('split_search_window_s', 5.0)),
            float(audio_cfg['min_segment_duration_s'])
        )
        segment_audio = []
        for segment in stt_segments:
            audio = build_segment_audio(segment, mono_waveform, sample_rate)
            if audio is not None:
                segment_audio.append((segment, audio))
        progress('stt', 45, 'Running STT on {} chunks'.format(len(segment_audio)))
        results = []
        batch_size = int(stt_cfg['batch_size'])
        total_batches = max(1, (len(segment_audio) + batch_size - 1) // batch_size)
        for batch_index, batch_start in enumerate(range(0, len(segment_audio), batch_size), start=1):
            batch = segment_audio[batch_start:batch_start + batch_size]
            progress('stt', 45 + int(43 * (batch_index - 1) / total_batches), 'Running STT batch {}/{}'.format(batch_index, total_batches))
            batch_results = stt_model.transcribe(audio=[audio for _, audio in batch], language=[audio_cfg.get('language', 'Korean')] * len(batch))
            results.extend(batch_results)
        sentences = []
        for segment, result in zip((item[0] for item in segment_audio), results):
            content = get_transcript_text(result)
            if not content:
                continue
            sentences.append({
                'index': len(sentences) + 1,
                'speaker': speaker_map[segment['speaker']],
                'speaker_id': speaker_map[segment['speaker']],
                'content': content,
                'start': segment['start'],
                'end': segment['end'],
                'time': format_time_range(segment['start'], segment['end'])
            })
        output = {'audio_length': round(audio_length, 1), 'total_speakers': len(speaker_ids), 'sentences': sentences, 'segment_stats': {k: len(v) for k, v in cleaned.items()}}
        write_json(output_dir / 'stt_result.json', output)
        progress('stt_completed', 88, 'Diarization and STT completed')
        return output
    finally:
        waveform = None
        mono_waveform = None
        diarization_pipeline = None
        stt_model = None
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass


def extract_json_object(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        pass
    for block in re.findall(r'```(?:json)?\s*([\s\S]*?)```', text):
        try:
            return json.loads(block)
        except Exception:
            pass
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return None


def format_transcript_for_llm(sentences: list[dict[str, Any]]) -> str:
    lines = []
    for sentence in sentences:
        content = sentence.get('content', '').strip()
        if content:
            lines.append('[{}] Speaker {}: {}'.format(sentence.get('index'), sentence.get('speaker_id', sentence.get('speaker')), content))
    return '\n'.join(lines)


def chat_completion(prompt: str, config: dict[str, Any]) -> str:
    from openai import AzureOpenAI
    llm_cfg = config['llm']
    api_key = os.getenv(llm_cfg.get('api_key_env', 'OPENAI_API_KEY'))
    base_url = os.getenv(llm_cfg.get('base_url_env', 'OPENAI_BASE_URL'))
    api_version = os.getenv(llm_cfg.get('api_version_env', 'OPENAI_API_VERSION'), llm_cfg.get('api_version_default', '2025-04-01-preview'))
    model = os.getenv(llm_cfg.get('model_env', 'OPENAI_MODEL'), llm_cfg.get('model_default', 'gpt-4o-mini'))
    if not api_key or not base_url:
        raise RuntimeError('LLM API key and base URL are required for postprocessing')
    client = AzureOpenAI(azure_endpoint=base_url, api_key=api_key, api_version=api_version)
    response = client.chat.completions.create(model=model, messages=[{'role': 'user', 'content': prompt}], temperature=0)
    return response.choices[0].message.content.strip()


def keep_first_consecutive_duplicate_content(sentences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = []
    current_run = []
    current_content = None
    def merge_run(run: list[dict[str, Any]]) -> dict[str, Any]:
        merged = dict(run[0])
        if len(run) > 1 and 'start' in run[0] and 'end' in run[-1]:
            merged['start'] = run[0]['start']
            merged['end'] = run[-1]['end']
            merged['time'] = format_time_range(merged['start'], merged['end'])
        return merged
    for sentence in sentences:
        content = sentence.get('content', '').strip()
        if current_run and content != current_content:
            cleaned.append(merge_run(current_run))
            current_run = []
        current_run.append(sentence)
        current_content = content
    if current_run:
        cleaned.append(merge_run(current_run))
    for index, sentence in enumerate(cleaned, start=1):
        sentence['index'] = index
    return cleaned


def batched(items: list[Any], batch_size: int):
    for start in range(0, len(items), batch_size):
        yield start // batch_size + 1, items[start:start + batch_size]


def build_correction_prompt(sentences: list[dict[str, Any]], participants: str, context: str, reference_text: str) -> str:
    return '''You are a conservative transcript correction reviewer.
Correct only clear speech-to-text mistakes such as spelling, spacing, numbers, dates, acronyms, names, or domain terms. Preserve the full meaning and wording. Do not summarize, rewrite, add facts, or force names to match the participant list.

Participants:
{participants}

Business context:
{context}

Reference text for terminology only:
{reference_text}

Return only valid JSON with a corrections array. Each item must include index, original_content, corrected_content, reason, and confidence from 0.0 to 1.0. If nothing should be changed, return an empty corrections array.

Transcript:
{transcript}
'''.format(participants=participants or 'None', context=context or 'None', reference_text=reference_text or 'None', transcript=format_transcript_for_llm(sentences))


def build_speaker_prompt(sentences: list[dict[str, Any]], total_speakers: int, participants: str) -> str:
    last_speaker_id = max(total_speakers - 1, 0)
    return '''Match each speaker_id from Speaker 0 through Speaker {last_speaker_id} to one participant, or to an unknown speaker label if evidence is weak.
Use only the exact participant strings listed below, or labels in the form Unknown speaker N. Do not invent people. Confidence below 0.75 must be assigned to an unknown speaker label.

Participants:
{participants}

Return only valid JSON with a matches array. Each item must include speaker_id, participant_match, confidence, evidence, and match_basis.

Transcript:
{transcript}
'''.format(last_speaker_id=last_speaker_id, participants=participants or 'None', transcript=format_transcript_for_llm(sentences))


def apply_stt_corrections(sentences: list[dict[str, Any]], corrections: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    corrected = [dict(s) for s in sentences]
    by_index = {s['index']: s for s in corrected}
    applied = []
    for correction in corrections:
        index = correction.get('index')
        sentence = by_index.get(index)
        corrected_content = str(correction.get('corrected_content', '')).strip()
        if not sentence or not corrected_content or corrected_content == sentence.get('content', ''):
            continue
        original = sentence.get('content', '')
        sentence['content'] = corrected_content
        applied.append({'index': index, 'original_content': original, 'corrected_content': corrected_content, 'reason': correction.get('reason', ''), 'confidence': correction.get('confidence')})
    return corrected, applied


def merge_consecutive_transcript_sentences(sentences: list[dict[str, Any]], max_silence_s: float) -> list[dict[str, Any]]:
    if not sentences:
        return []
    merged = []
    current = dict(sentences[0])
    for sentence in sentences[1:]:
        silence_s = sentence.get('start', 0) - current.get('end', 0)
        if sentence.get('speaker') == current.get('speaker') and silence_s < max_silence_s:
            current['end'] = max(current.get('end', 0), sentence.get('end', 0))
            current['content'] = '{} {}'.format(current.get('content', ''), sentence.get('content', '')).strip()
            current['time'] = format_time_range(current.get('start', 0), current.get('end', 0))
        else:
            merged.append(current)
            current = dict(sentence)
    merged.append(current)
    for index, sentence in enumerate(merged, start=1):
        sentence['index'] = index
    return merged


def apply_speaker_matches(sentences: list[dict[str, Any]], matches_data: dict[str, Any]) -> list[dict[str, Any]]:
    speaker_matches = {}
    for match in matches_data.get('matches', []):
        if 'speaker_id' in match and 'participant_match' in match:
            speaker_matches[str(match['speaker_id'])] = match['participant_match']
    mapped = []
    for sentence in sentences:
        item = dict(sentence)
        speaker_id = item.get('speaker_id', item.get('speaker'))
        item['speaker_id'] = speaker_id
        item['speaker'] = speaker_matches.get(str(speaker_id), 'Speaker {}'.format(speaker_id))
        mapped.append(item)
    return mapped


def llm_postprocess(stt_result: dict[str, Any], output_dir: Path, participants: str, context: str, reference_text: str, config: dict[str, Any], skip_llm: bool) -> dict[str, Any]:
    sentences = keep_first_consecutive_duplicate_content(stt_result.get('sentences', []))
    for sentence in sentences:
        sentence.setdefault('speaker_id', sentence.get('speaker'))
    write_json(output_dir / 'original_result.json', sentences)
    if skip_llm or not config.get('llm', {}).get('enabled', True):
        matches = {'matches': []}
        mapped = apply_speaker_matches(sentences, matches)
        write_json(output_dir / 'stt_corrections.json', {'corrections': []})
        write_json(output_dir / 'speaker_matches.json', matches)
        write_json(output_dir / 'refined_result.json', mapped)
        return {'original_sentences': sentences, 'corrected_sentences': sentences, 'stt_corrections': {'corrections': []}, 'speaker_matches': matches, 'refined_sentences': mapped}

    batch_size = int(config['llm'].get('correction_batch_size', 50))
    all_corrections = []
    total_batches = max(1, (len(sentences) + batch_size - 1) // batch_size)
    for batch_index, batch_sentences in batched(sentences, batch_size):
        progress('stt_correction', 90 + int(4 * (batch_index - 1) / total_batches), 'Running correction batch {}/{}'.format(batch_index, total_batches))
        parsed = extract_json_object(chat_completion(build_correction_prompt(batch_sentences, participants, context, reference_text), config)) or {}
        all_corrections.extend(parsed.get('corrections', []))
    corrected, applied = apply_stt_corrections(sentences, all_corrections)
    corrected = merge_consecutive_transcript_sentences(corrected, float(config['audio']['max_merge_silence_s']))
    corrections_output = {'corrections': applied}
    write_json(output_dir / 'stt_corrections.json', corrections_output)

    progress('speaker_matching', 95, 'Running speaker matching')
    matches = extract_json_object(chat_completion(build_speaker_prompt(corrected, int(stt_result.get('total_speakers', 0)), participants), config)) or {'matches': []}
    mapped = apply_speaker_matches(corrected, matches)
    write_json(output_dir / 'speaker_matches.json', matches)
    write_json(output_dir / 'refined_result.json', mapped)
    return {'original_sentences': sentences, 'corrected_sentences': corrected, 'stt_corrections': corrections_output, 'speaker_matches': matches, 'refined_sentences': mapped}


def validate_inputs(args: argparse.Namespace, config: dict[str, Any]) -> list[str]:
    errors = []
    if not args.audio:
        errors.append('Missing --audio')
    elif not Path(args.audio).exists():
        errors.append('Audio file does not exist: {}'.format(args.audio))
    if not args.participants:
        errors.append('Missing --participants')
    elif not participant_list(args.participants):
        errors.append('Participant list is empty')
    if not config.get('stt', {}).get('model_path'):
        errors.append('Missing stt.model_path')
    if not config.get('diarization', {}).get('model_id'):
        errors.append('Missing diarization.model_id')
    if config.get('llm', {}).get('enabled', True) and not args.skip_llm:
        llm = config['llm']
        if not os.getenv(llm.get('api_key_env', 'OPENAI_API_KEY')):
            errors.append('Missing LLM API key environment variable: {}'.format(llm.get('api_key_env', 'OPENAI_API_KEY')))
        if not os.getenv(llm.get('base_url_env', 'OPENAI_BASE_URL')):
            errors.append('Missing LLM base URL environment variable: {}'.format(llm.get('base_url_env', 'OPENAI_BASE_URL')))
    return errors


def write_example_config(path: Path) -> None:
    write_json(path, DEFAULT_CONFIG)
    print('Wrote example config to {}'.format(path))


def main() -> int:
    parser = argparse.ArgumentParser(description='Run or validate an audio diarization, STT, and LLM postprocessing pipeline')
    parser.add_argument('--config', help='Path to JSON config')
    parser.add_argument('--audio', help='Path to audio file')
    parser.add_argument('--participants', help='Comma-separated participant list or path to a text file')
    parser.add_argument('--context', default='', help='Meeting purpose or business context')
    parser.add_argument('--reference-text', default='', help='Reference text or path to a text file')
    parser.add_argument('--output-dir', default='out/audio-pipeline-run', help='Directory for JSON outputs')
    parser.add_argument('--validate-only', action='store_true', help='Validate inputs and configuration without running models')
    parser.add_argument('--skip-llm', action='store_true', help='Run diarization and STT but skip correction and speaker matching')
    parser.add_argument('--write-example-config', help='Write an example JSON config to this path and exit')
    args = parser.parse_args()

    if args.write_example_config:
        write_example_config(Path(args.write_example_config))
        return 0

    config = load_config(args.config)
    errors = validate_inputs(args, config)
    if errors:
        for error in errors:
            print('ERROR: {}'.format(error), file=sys.stderr)
        return 2
    if args.validate_only:
        print('Validation passed')
        return 0

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    participants = participant_list(args.participants)
    context = read_text_or_value(args.context)
    reference_text = read_text_or_value(args.reference_text)
    start = time.time()
    stt_result = transcribe_audio(Path(args.audio), output_dir, config)
    post = llm_postprocess(stt_result, output_dir, participants, context, reference_text, config, args.skip_llm)
    summary = {
        'audio': str(Path(args.audio).resolve()),
        'output_dir': str(output_dir.resolve()),
        'audio_length': stt_result.get('audio_length'),
        'total_speakers': stt_result.get('total_speakers'),
        'stt_sentences': len(stt_result.get('sentences', [])),
        'applied_corrections': len(post.get('stt_corrections', {}).get('corrections', [])),
        'refined_sentences': len(post.get('refined_sentences', [])),
        'elapsed': elapsed(start)
    }
    write_json(output_dir / 'pipeline_summary.json', summary)
    progress('completed', 100, 'Pipeline completed in {}'.format(summary['elapsed']))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
