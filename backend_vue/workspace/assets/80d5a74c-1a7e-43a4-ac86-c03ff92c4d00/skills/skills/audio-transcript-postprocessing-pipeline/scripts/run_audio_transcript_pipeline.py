#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gc
import json
import os
import time
from pathlib import Path
from typing import Any


def load_env_file(path: str | None):
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
        os.environ.setdefault(key.strip(), value.strip().strip(chr(34)).strip(chr(39)))


def cfg(data: dict, dotted: str, default: Any = None) -> Any:
    current: Any = data
    for part in dotted.split('.'):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def read_text_or_literal(value: str | None) -> str:
    if not value:
        return ''
    path = Path(value)
    if path.exists():
        return path.read_text(encoding='utf-8').strip()
    return value.strip()


def progress(stage: str, percent: int, message: str):
    print(f'[{stage} {percent}%] {message}', flush=True)


def elapsed(start: float) -> str:
    return f'{time.time() - start:.1f}s'


def format_time_range(start_s: float, end_s: float) -> str:
    return f'{start_s:.1f}s - {end_s:.1f}s'


def merge_consecutive_speaker_segments(segments: list[dict], max_silence_s: float) -> list[dict]:
    if not segments:
        return []
    sorted_segments = sorted(segments, key=lambda item: item['start'])
    merged = []
    current = sorted_segments[0].copy()
    for segment in sorted_segments[1:]:
        silence_s = segment['start'] - current['end']
        if segment['speaker'] == current['speaker'] and silence_s < max_silence_s:
            current['end'] = max(current['end'], segment['end'])
        else:
            merged.append(current)
            current = segment.copy()
    merged.append(current)
    return merged


def drop_short_segments(segments: list[dict], min_duration_s: float) -> list[dict]:
    return [segment for segment in segments if segment['end'] - segment['start'] >= min_duration_s]


def fix_overlapping_segments(segments: list[dict]) -> list[dict]:
    if not segments:
        return []
    result = [segments[0].copy()]
    for segment in segments[1:]:
        previous = result[-1]
        fixed = segment.copy()
        if fixed['start'] < previous['end']:
            fixed['start'] = previous['end'] + 0.1
        if fixed['end'] <= fixed['start']:
            fixed['end'] = fixed['start'] + 0.1
        result.append(fixed)
    return result


def preprocess_speaker_segments(segments: list[dict], max_silence_s: float, min_duration_s: float) -> list[dict]:
    first = merge_consecutive_speaker_segments(segments, max_silence_s)
    filtered = drop_short_segments(first, min_duration_s)
    second = merge_consecutive_speaker_segments(filtered, max_silence_s)
    fixed = fix_overlapping_segments(second)
    final_filtered = drop_short_segments(fixed, min_duration_s)
    return merge_consecutive_speaker_segments(final_filtered, max_silence_s)


def find_low_energy_split_time(mono_waveform, sample_rate: int, search_start_s: float, search_end_s: float, frame_s: float = 0.2, hop_s: float = 0.05) -> float:
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


def split_long_speaker_segments(segments: list[dict], max_duration_s: float, mono_waveform, sample_rate: int, search_window_s: float, min_chunk_s: float) -> list[dict]:
    output = []
    for segment in segments:
        start = segment['start']
        end = segment['end']
        if end - start <= max_duration_s:
            output.append(segment.copy())
            continue
        current_start = start
        while end - current_start > max_duration_s:
            target_end = current_start + max_duration_s
            search_start = max(current_start + min_chunk_s, target_end - search_window_s)
            search_end = min(target_end, end)
            split_time = find_low_energy_split_time(mono_waveform, sample_rate, search_start, search_end)
            if split_time <= current_start + min_chunk_s or split_time > target_end:
                split_time = target_end
            piece = segment.copy()
            piece['start'] = current_start
            piece['end'] = split_time
            output.append(piece)
            current_start = split_time
        if end - current_start >= min_chunk_s:
            piece = segment.copy()
            piece['start'] = current_start
            piece['end'] = end
            output.append(piece)
        elif output:
            output[-1]['end'] = end
    return output


def build_segment_audio(segment: dict, mono_waveform, sample_rate: int):
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


def format_transcript_sentences(sentences: list[dict]) -> list[dict]:
    output = []
    for index, sentence in enumerate(sentences, start=1):
        item = sentence.copy()
        item['index'] = index
        item['time'] = format_time_range(item['start'], item['end'])
        output.append(item)
    return output


def keep_first_consecutive_duplicate_content(sentences: list[dict]) -> list[dict]:
    cleaned = []
    current_run = []
    current_content = None

    def merge_run(run: list[dict]) -> dict:
        merged = run[0].copy()
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


def merge_consecutive_transcript_sentences(sentences: list[dict], max_silence_s: float) -> list[dict]:
    if not sentences:
        return []
    merged = []
    current = sentences[0].copy()
    for sentence in sentences[1:]:
        silence_s = sentence.get('start', 0) - current.get('end', 0)
        if sentence.get('speaker') == current.get('speaker') and silence_s < max_silence_s:
            current['end'] = max(current.get('end', 0), sentence.get('end', 0))
            current['content'] = (current.get('content', '') + ' ' + sentence.get('content', '')).strip()
            current['time'] = format_time_range(current['start'], current['end'])
        else:
            merged.append(current)
            current = sentence.copy()
    merged.append(current)
    output = []
    for index, sentence in enumerate(merged, start=1):
        item = {
            'index': index,
            'speaker': sentence.get('speaker'),
            'speaker_id': sentence.get('speaker_id', sentence.get('speaker')),
            'content': sentence.get('content', ''),
            'time': sentence.get('time', ''),
            'start': sentence.get('start'),
            'end': sentence.get('end')
        }
        output.append(item)
    return output


def extract_json_object(text: str) -> dict | None:
    candidates = [text]
    stripped = text.strip()
    if stripped.startswith('```'):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            candidates.append(chr(10).join(lines[1:-1]))
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        candidates.append(text[start:end + 1])
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception:
            pass
    return None


def format_transcript_for_llm(sentences: list[dict]) -> str:
    lines = []
    for sentence in sentences:
        content = sentence.get('content', '').strip()
        if content:
            speaker_id = sentence.get('speaker_id', sentence.get('speaker'))
            lines.append('[{}] Speaker {}: {}'.format(sentence.get('index'), speaker_id, content))
    return chr(10).join(lines)


def chat_completion(prompt_text: str, config: dict) -> str:
    from openai import AzureOpenAI
    llm = config.get('llm', {})
    api_key = os.getenv(llm.get('api_key_env', 'OPENAI_API_KEY'), '')
    base_url = os.getenv(llm.get('base_url_env', 'OPENAI_BASE_URL'), '')
    api_version = os.getenv(llm.get('api_version_env', 'OPENAI_API_VERSION'), llm.get('api_version_default', '2025-04-01-preview'))
    model = os.getenv(llm.get('model_env', 'OPENAI_MODEL'), llm.get('model_default', 'gpt-4.1'))
    if not api_key or not base_url:
        raise RuntimeError('LLM API key and base URL environment variables are required.')
    client = AzureOpenAI(azure_endpoint=base_url, api_key=api_key, api_version=api_version)
    response = client.chat.completions.create(model=model, messages=[{'role': 'user', 'content': prompt_text}])
    return response.choices[0].message.content.strip()


def build_stt_correction_prompt(sentences: list[dict], participants: str, purpose: str, reference_text: str) -> str:
    nl = chr(10)
    return nl.join([
        'You correct speech-to-text transcript errors using only strong evidence from context.',
        'Preserve the full utterance. Do not summarize, rewrite, or add information.',
        'Use the participant list and reference text only as vocabulary support.',
        'Return only valid JSON with key corrections. Each correction must include index, original_content, corrected_content, reason, and confidence.',
        'If there are no clear corrections, return an empty corrections array.',
        '',
        'Participants:', participants or 'None',
        'Purpose:', purpose or 'None',
        'Reference text:', reference_text or 'None',
        'Transcript:', format_transcript_for_llm(sentences)
    ])


def find_stt_corrections(sentences: list[dict], participants: str, purpose: str, reference_text: str, config: dict) -> list[dict]:
    batch_size = int(cfg(config, 'postprocess.correction_batch_size', 50))
    corrections = []
    for start in range(0, len(sentences), batch_size):
        batch = sentences[start:start + batch_size]
        progress('stt_correction', 90, f'Running correction batch {start // batch_size + 1}')
        parsed = extract_json_object(chat_completion(build_stt_correction_prompt(batch, participants, purpose, reference_text), config))
        if parsed:
            corrections.extend(parsed.get('corrections', []))
    return corrections


def apply_stt_corrections(sentences: list[dict], corrections: list[dict]) -> tuple[list[dict], list[dict]]:
    corrected = [sentence.copy() for sentence in sentences]
    by_index = {sentence['index']: sentence for sentence in corrected}
    applied = []
    for correction in corrections:
        index = correction.get('index')
        corrected_content = str(correction.get('corrected_content', '')).strip()
        sentence = by_index.get(index)
        if not sentence or not corrected_content:
            continue
        original = sentence.get('content', '')
        if corrected_content == original:
            continue
        sentence['content'] = corrected_content
        applied.append({
            'index': index,
            'original_content': original,
            'corrected_content': corrected_content,
            'reason': correction.get('reason', ''),
            'confidence': correction.get('confidence')
        })
    return corrected, applied


def build_speaker_matching_prompt(sentences: list[dict], total_speakers: int, participants: str) -> str:
    nl = chr(10)
    return nl.join([
        'Match each detected speaker_id to one participant candidate when evidence is strong.',
        'Use only exact participant strings from the participant list, or an unknown speaker label.',
        'Do not invent names. Include every speaker_id from 0 through {}.'.format(max(total_speakers - 1, 0)),
        'Return only valid JSON with key matches. Each match must include speaker_id, participant_match, confidence, evidence, and match_basis.',
        '',
        'Participants:', participants or 'None',
        'Transcript:', format_transcript_for_llm(sentences)
    ])


def match_speakers(sentences: list[dict], total_speakers: int, participants: str, config: dict) -> dict:
    parsed = extract_json_object(chat_completion(build_speaker_matching_prompt(sentences, total_speakers, participants), config))
    return parsed if parsed else {'matches': []}


def apply_speaker_matches(sentences: list[dict], matches_data: dict) -> list[dict]:
    speaker_matches = {}
    unknown_counter = 1
    for match in matches_data.get('matches', []):
        speaker_id = str(match.get('speaker_id'))
        participant_match = str(match.get('participant_match', '')).strip()
        if not participant_match:
            participant_match = f'Unknown speaker {unknown_counter}'
            unknown_counter += 1
        speaker_matches[speaker_id] = participant_match
    mapped = []
    for sentence in sentences:
        item = sentence.copy()
        speaker_id = item.get('speaker_id', item.get('speaker'))
        item['speaker_id'] = speaker_id
        item['speaker'] = speaker_matches.get(str(speaker_id), f'Speaker {speaker_id}')
        mapped.append(item)
    return mapped


def transcribe_audio(audio_path: Path, output_dir: Path, config: dict) -> dict:
    import torch
    import torchaudio
    from pyannote.audio import Pipeline
    from qwen_asr import Qwen3ASRModel

    if cfg(config, 'runtime.transformers_offline', False):
        os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    device_map = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    torch_dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32

    waveform = mono_waveform = None
    diarization_pipeline = stt_model = None
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        t = time.time()
        progress('loading', 5, 'Loading audio')
        waveform, sample_rate = torchaudio.load(str(audio_path))
        audio_length = waveform.shape[1] / sample_rate
        mono_waveform = waveform.mean(dim=0)
        progress('loading', 8, f'Loaded {audio_length:.1f}s audio in {elapsed(t)}')

        progress('diarization', 12, 'Loading diarization model')
        diarization_model = cfg(config, 'diarization.model')
        token_env = cfg(config, 'diarization.token_env', 'HF_TOKEN')
        token = os.getenv(token_env, '') if token_env else None
        diarization_pipeline = Pipeline.from_pretrained(diarization_model, token=token or None)
        diarization_pipeline.to(device)

        progress('diarization', 20, 'Running diarization')
        diarization = diarization_pipeline({'waveform': waveform, 'sample_rate': sample_rate})
        annotation = getattr(diarization, 'speaker_diarization', diarization)
        speaker_segments = [
            {'start': turn.start, 'end': turn.end, 'speaker': speaker}
            for turn, _, speaker in annotation.itertracks(yield_label=True)
        ]
        speaker_ids = sorted({segment['speaker'] for segment in speaker_segments})
        speaker_map = {speaker: index for index, speaker in enumerate(speaker_ids)}
        merged_segments = preprocess_speaker_segments(
            speaker_segments,
            float(cfg(config, 'segmentation.max_merge_silence_s', 10.0)),
            float(cfg(config, 'segmentation.min_segment_duration_s', 1.5))
        )
        progress('diarization', 30, f'Detected {len(speaker_ids)} speakers and {len(merged_segments)} merged segments')

        progress('stt', 35, 'Loading ASR model')
        if cfg(config, 'asr.provider', 'qwen_asr') != 'qwen_asr':
            raise RuntimeError('This skeleton implements the qwen_asr provider. Keep the output schema if replacing it.')
        batch_size = int(cfg(config, 'asr.batch_size', 8))
        stt_model = Qwen3ASRModel.from_pretrained(
            cfg(config, 'asr.model_path'),
            dtype=torch_dtype,
            device_map=device_map,
            max_inference_batch_size=batch_size,
            max_new_tokens=int(cfg(config, 'asr.max_new_tokens', 512))
        )
        for candidate in (stt_model, getattr(stt_model, 'model', None)):
            generation_config = getattr(candidate, 'generation_config', None)
            if generation_config is not None and getattr(generation_config, 'pad_token_id', None) is None:
                eos_token_id = getattr(generation_config, 'eos_token_id', None)
                generation_config.pad_token_id = eos_token_id[0] if isinstance(eos_token_id, list) else eos_token_id

        progress('stt', 45, 'Running segment-level ASR')
        stt_segments = split_long_speaker_segments(
            merged_segments,
            float(cfg(config, 'segmentation.max_stt_segment_duration_s', 30.0)),
            mono_waveform,
            sample_rate,
            float(cfg(config, 'segmentation.low_energy_search_window_s', 5.0)),
            float(cfg(config, 'segmentation.min_segment_duration_s', 1.5))
        )
        inputs = []
        for segment in stt_segments:
            audio = build_segment_audio(segment, mono_waveform, sample_rate)
            if audio is not None:
                inputs.append((segment, audio))
        stt_results = []
        language = cfg(config, 'asr.language', 'Korean')
        total_batches = max(1, (len(inputs) + batch_size - 1) // batch_size)
        for batch_index, start in enumerate(range(0, len(inputs), batch_size), start=1):
            batch = inputs[start:start + batch_size]
            progress('stt', 45 + int(40 * batch_index / total_batches), f'ASR batch {batch_index}/{total_batches}')
            stt_results.extend(stt_model.transcribe(audio=[audio for _, audio in batch], language=[language] * len(batch)))

        sentences = []
        for segment, result in zip((item[0] for item in inputs), stt_results):
            content = get_transcript_text(result)
            if content:
                sentences.append({
                    'index': len(sentences) + 1,
                    'speaker': speaker_map[segment['speaker']],
                    'content': content,
                    'start': segment['start'],
                    'end': segment['end']
                })
        output = {
            'audio_length': round(audio_length, 1),
            'total_speakers': len(speaker_ids),
            'sentences': format_transcript_sentences(sentences)
        }
        (output_dir / 'raw_result.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
        progress('stt_completed', 88, 'Diarization and ASR completed')
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


def run_postprocess(raw_result: dict, output_dir: Path, participants: str, purpose: str, reference_text: str, config: dict) -> dict:
    max_silence = float(cfg(config, 'segmentation.max_merge_silence_s', 10.0))
    sentences = keep_first_consecutive_duplicate_content(raw_result.get('sentences', []))
    for sentence in sentences:
        sentence.setdefault('speaker_id', sentence.get('speaker'))
    (output_dir / 'original_result.json').write_text(json.dumps(sentences, ensure_ascii=False, indent=2), encoding='utf-8')

    corrections = find_stt_corrections(sentences, participants, purpose, reference_text, config)
    corrected, applied = apply_stt_corrections(sentences, corrections)
    (output_dir / 'stt_corrections.json').write_text(json.dumps({'corrections': applied}, ensure_ascii=False, indent=2), encoding='utf-8')
    corrected = merge_consecutive_transcript_sentences(corrected, max_silence)

    progress('speaker_matching', 95, 'Matching speakers to participant candidates')
    matches = match_speakers(corrected, int(raw_result.get('total_speakers', 0)), participants, config)
    refined = apply_speaker_matches(corrected, matches)
    (output_dir / 'speaker_matches.json').write_text(json.dumps(matches, ensure_ascii=False, indent=2), encoding='utf-8')
    (output_dir / 'refined_result.json').write_text(json.dumps(refined, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'refined_sentences': refined, 'speaker_matches': matches, 'stt_corrections': applied}


def main() -> int:
    parser = argparse.ArgumentParser(description='Run an audio diarization, ASR, correction, and speaker matching pipeline.')
    parser.add_argument('--config', required=True, help='Path to the pipeline JSON config.')
    parser.add_argument('--audio', required=True, help='Input audio file path.')
    parser.add_argument('--output-dir', required=True, help='Directory for JSON outputs.')
    parser.add_argument('--participants', required=True, help='Participant list text or a path to a text file.')
    parser.add_argument('--purpose', default='', help='Session purpose or short agenda.')
    parser.add_argument('--reference-text', default='', help='Reference text or a path to a glossary or agenda file.')
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding='utf-8'))
    load_env_file(cfg(config, 'runtime.env_file', '.env'))
    audio_path = Path(args.audio)
    output_dir = Path(args.output_dir)
    if not audio_path.exists():
        raise FileNotFoundError(f'Audio file not found: {audio_path}')
    participants = read_text_or_literal(args.participants)
    reference_text = read_text_or_literal(args.reference_text)
    if not participants:
        raise ValueError('Participants are required.')

    started = time.time()
    raw_result = transcribe_audio(audio_path, output_dir, config)
    postprocess = run_postprocess(raw_result, output_dir, participants, args.purpose, reference_text, config)
    metadata = {
        'audio': str(audio_path),
        'output_dir': str(output_dir),
        'elapsed_s': round(time.time() - started, 1),
        'sentence_count': len(postprocess['refined_sentences'])
    }
    (output_dir / 'run_metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    progress('done', 100, f'Pipeline completed in {metadata[chr(39) + 'elapsed_s' + chr(39)]}s')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
