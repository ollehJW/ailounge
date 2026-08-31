#!/usr/bin/env python3
# Config-driven skeleton for assembling audio transcript artifacts into reviewable records.
import argparse
import datetime as dt
import json
import shutil
import sys
from pathlib import Path

NL = chr(10)


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def dump_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def read_optional_json(path):
    if not path:
        return None
    file_path = Path(path)
    if not file_path.exists():
        return None
    return load_json(file_path)


def fail(message):
    print(f'ERROR: {message}', file=sys.stderr)
    sys.exit(1)


def input_path(cfg, key):
    return cfg.get('input_paths', {}).get(key)


def format_time_range(start_s, end_s):
    return f'{float(start_s):.1f}s - {float(end_s):.1f}s'


def merge_consecutive_speaker_segments(segments, max_silence_s):
    if not segments:
        return []
    sorted_segments = sorted(segments, key=lambda item: float(item.get('start', 0)))
    merged = []
    current = dict(sorted_segments[0])
    for segment in sorted_segments[1:]:
        segment = dict(segment)
        silence_s = float(segment.get('start', 0)) - float(current.get('end', 0))
        can_merge = segment.get('speaker') == current.get('speaker') and silence_s < max_silence_s
        if can_merge:
            current['end'] = max(float(current.get('end', 0)), float(segment.get('end', 0)))
        else:
            merged.append(current)
            current = segment
    merged.append(current)
    return merged


def drop_short_segments(segments, min_duration_s):
    return [item for item in segments if float(item.get('end', 0)) - float(item.get('start', 0)) >= min_duration_s]


def fix_overlapping_segments(segments):
    if not segments:
        return []
    fixed = [dict(segments[0])]
    for segment in segments[1:]:
        item = dict(segment)
        previous = fixed[-1]
        if float(item.get('start', 0)) < float(previous.get('end', 0)):
            item['start'] = float(previous.get('end', 0)) + 0.1
        if float(item.get('end', 0)) <= float(item.get('start', 0)):
            item['end'] = float(item.get('start', 0)) + 0.1
        fixed.append(item)
    return fixed


def split_long_segments(segments, max_duration_s, min_chunk_s):
    if not max_duration_s or max_duration_s <= 0:
        return [dict(item) for item in segments]
    output = []
    for segment in segments:
        start = float(segment.get('start', 0))
        end = float(segment.get('end', 0))
        if end - start <= max_duration_s:
            output.append(dict(segment))
            continue
        current_start = start
        while end - current_start > max_duration_s:
            item = dict(segment)
            item['start'] = current_start
            item['end'] = current_start + max_duration_s
            output.append(item)
            current_start = item['end']
        if end - current_start >= min_chunk_s:
            item = dict(segment)
            item['start'] = current_start
            item['end'] = end
            output.append(item)
        elif output:
            output[-1]['end'] = end
    return output


def preprocess_segments(raw_segments, processing):
    max_silence_s = float(processing.get('max_merge_silence_s', 10.0))
    min_duration_s = float(processing.get('min_segment_duration_s', 1.5))
    max_duration_s = float(processing.get('max_stt_segment_duration_s', 30.0))
    merged = merge_consecutive_speaker_segments(raw_segments, max_silence_s)
    filtered = drop_short_segments(merged, min_duration_s)
    merged_again = merge_consecutive_speaker_segments(filtered, max_silence_s)
    fixed = fix_overlapping_segments(merged_again)
    split = split_long_segments(fixed, max_duration_s, min_duration_s)
    final_segments = drop_short_segments(split, min_duration_s)
    for index, item in enumerate(final_segments, start=1):
        item['index'] = index
        item['time'] = format_time_range(item.get('start', 0), item.get('end', 0))
    return final_segments


def normalize_sentences(data):
    sentences = data.get('sentences', []) if isinstance(data, dict) else data
    if not isinstance(sentences, list):
        fail('STT sentences must be a list or an object with a sentences list.')
    normalized = []
    for index, sentence in enumerate(sentences, start=1):
        if not isinstance(sentence, dict):
            continue
        item = dict(sentence)
        item['index'] = int(item.get('index') or index)
        item['speaker'] = item.get('speaker', item.get('speaker_id', 'Unknown'))
        if 'speaker_id' not in item:
            item['speaker_id'] = item.get('speaker')
        item['content'] = str(item.get('content', '')).strip()
        if not item.get('time') and 'start' in item and 'end' in item:
            item['time'] = format_time_range(item['start'], item['end'])
        item['time'] = item.get('time', '')
        if item['content']:
            normalized.append(item)
    return normalized


def apply_stt_corrections(sentences, correction_data):
    corrections = []
    if isinstance(correction_data, dict):
        corrections = correction_data.get('corrections', [])
    elif isinstance(correction_data, list):
        corrections = correction_data
    by_index = {item['index']: dict(item) for item in sentences}
    applied = []
    for correction in corrections:
        index = correction.get('index')
        if index not in by_index:
            continue
        corrected_content = str(correction.get('corrected_content', '')).strip()
        if not corrected_content:
            continue
        original_content = by_index[index].get('content', '')
        if corrected_content == original_content:
            continue
        by_index[index]['content'] = corrected_content
        applied.append({'index': index, 'original_content': original_content, 'corrected_content': corrected_content, 'reason': correction.get('reason', ''), 'confidence': correction.get('confidence')})
    return [by_index[item['index']] for item in sentences], applied


def apply_speaker_matches(sentences, matches_data):
    matches = matches_data.get('matches', []) if isinstance(matches_data, dict) else []
    speaker_map = {}
    for match in matches:
        if 'speaker_id' in match and 'participant_match' in match:
            speaker_map[str(match['speaker_id'])] = match['participant_match']
    mapped = []
    for sentence in sentences:
        item = dict(sentence)
        speaker_id = item.get('speaker_id', item.get('speaker'))
        item['speaker_id'] = speaker_id
        item['speaker'] = speaker_map.get(str(speaker_id), f'Speaker {speaker_id}')
        mapped.append(item)
    return mapped


def format_transcript(sentences):
    lines = []
    for sentence in sentences:
        index = sentence.get('index', '')
        speaker = sentence.get('speaker', 'Unknown')
        time_value = sentence.get('time', '')
        content = sentence.get('content', '').strip()
        if content:
            lines.append(f'[{index}] {speaker} ({time_value}): {content}')
    return NL.join(lines)


def build_document_prompt(cfg, sentences):
    metadata = cfg.get('metadata', {})
    document = cfg.get('document', {})
    sections = document.get('sections', [])
    instruction = document.get('special_instruction', 'None')
    transcript = format_transcript(sentences)
    lines = [
        '# Structured record generation prompt',
        '',
        'Generate a Markdown document from the grounded transcript only.',
        'Do not add facts that are not supported by the transcript.',
        'Mark uncertain decisions, owners, dates, or commitments as confirmation needed.',
        '',
        '## Metadata',
    ]
    for key, value in metadata.items():
        lines.append(f'- {key}: {value}')
    lines.extend(['', '## Required sections'])
    for section in sections:
        lines.append(f'- {section}')
    lines.extend(['', '## Special instruction', str(instruction).strip() or 'None', '', '## Transcript', transcript])
    return NL.join(lines)


def write_review_checklist(output_dir):
    checklist = [
        '# Human review checklist',
        '',
        '- Confirm that speaker names are correct or intentionally unresolved.',
        '- Compare important decisions and action items against transcript evidence.',
        '- Remove unsupported claims or mark them as confirmation needed.',
        '- Check whether sensitive personal or business information should be redacted.',
        '- Approve the final document before distribution or archival.',
    ]
    (output_dir / 'review_checklist.md').write_text(NL.join(checklist), encoding='utf-8')


def prepare_mode(cfg, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    dump_json(output_dir / 'normalized_config.json', cfg)
    manifest = {
        'created_at': dt.datetime.utcnow().isoformat() + 'Z',
        'audio_file': cfg.get('audio_file'),
        'stages': ['diarization', 'segment_preprocessing', 'stt', 'stt_correction', 'speaker_matching', 'document_generation', 'human_review'],
        'expected_input_paths': cfg.get('input_paths', {}),
    }
    dump_json(output_dir / 'run_manifest.json', manifest)
    segments_path = input_path(cfg, 'diarization_segments')
    if segments_path and Path(segments_path).exists():
        raw = load_json(segments_path)
        raw_segments = raw.get('segments', raw) if isinstance(raw, dict) else raw
        processed = preprocess_segments(raw_segments, cfg.get('processing', {}))
        dump_json(output_dir / 'processed_segments.json', processed)
    write_review_checklist(output_dir)
    print(f'Prepared workspace: {output_dir}')


def assemble_mode(cfg, output_dir, force=False):
    output_dir.mkdir(parents=True, exist_ok=True)
    target_prompt = output_dir / 'document_generation_prompt.md'
    if target_prompt.exists() and not force:
        fail('Output already exists. Re-run with --force to overwrite assembly artifacts.')
    stt_path = input_path(cfg, 'stt_sentences')
    if not stt_path or not Path(stt_path).exists():
        fail('input_paths.stt_sentences is required for assemble mode.')
    original = normalize_sentences(load_json(stt_path))
    dump_json(output_dir / 'original_transcript.json', original)
    correction_data = read_optional_json(input_path(cfg, 'stt_corrections'))
    corrected, applied = apply_stt_corrections(original, correction_data or {'corrections': []})
    dump_json(output_dir / 'corrected_transcript.json', corrected)
    dump_json(output_dir / 'applied_corrections.json', applied)
    matches_data = read_optional_json(input_path(cfg, 'speaker_matches')) or {'matches': []}
    mapped = apply_speaker_matches(corrected, matches_data)
    dump_json(output_dir / 'speaker_mapped_transcript.json', mapped)
    prompt = build_document_prompt(cfg, mapped)
    target_prompt.write_text(prompt, encoding='utf-8')
    generated_doc = input_path(cfg, 'generated_document')
    if generated_doc and Path(generated_doc).exists():
        shutil.copyfile(generated_doc, output_dir / 'final_document.md')
    write_review_checklist(output_dir)
    print(f'Assembled review artifacts: {output_dir}')


def main():
    parser = argparse.ArgumentParser(description='Run the reusable audio document pipeline skeleton.')
    parser.add_argument('--config', required=True, help='Path to the JSON configuration file.')
    parser.add_argument('--output-dir', required=True, help='Directory for workspace and assembled artifacts.')
    parser.add_argument('--mode', choices=['prepare', 'assemble'], required=True, help='prepare creates a workspace; assemble normalizes model outputs.')
    parser.add_argument('--force', action='store_true', help='Overwrite assembly artifacts when they already exist.')
    args = parser.parse_args()

    cfg = load_json(args.config)
    output_dir = Path(args.output_dir)
    if args.mode == 'prepare':
        prepare_mode(cfg, output_dir)
    else:
        assemble_mode(cfg, output_dir, force=args.force)


if __name__ == '__main__':
    main()
