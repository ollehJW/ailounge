#!/usr/bin/env python3
'''Generate a grounded Markdown report from speaker-attributed transcript JSON.'''
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree

SUPPORTED_REFERENCE_EXTENSIONS = {'.txt', '.md', '.pdf', '.pptx', '.ppt'}
DEFAULT_SECTIONS = ['Summary', 'Key discussion', 'Decisions', 'Action items', 'Risks', 'Key questions']


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


def normalize_text(text: str) -> str:
    lines: list[str] = []
    previous_blank = False
    for raw_line in text.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        line = ' '.join(raw_line.split()).strip()
        if not line:
            if not previous_blank:
                lines.append('')
            previous_blank = True
            continue
        lines.append(line)
        previous_blank = False
    return '\n'.join(lines).strip()


def slide_sort_key(path: str) -> tuple[int, str]:
    marker = 'slide'
    name = Path(path).name
    if marker in name and name.endswith('.xml'):
        digits = ''.join(ch for ch in name if ch.isdigit())
        return (int(digits) if digits else 0, path)
    return (0, path)


def extract_text_from_xml(xml_bytes: bytes) -> list[str]:
    root = ElementTree.fromstring(xml_bytes)
    texts: list[str] = []
    for element in root.iter():
        if element.tag.endswith('}t') and element.text:
            text = element.text.strip()
            if text:
                texts.append(text)
    return texts


def read_pptx_text(path: Path) -> str:
    chunks: list[str] = []
    with zipfile.ZipFile(path) as archive:
        slide_names = sorted(
            (name for name in archive.namelist() if name.startswith('ppt/slides/slide') and name.endswith('.xml')),
            key=slide_sort_key,
        )
        for slide_index, slide_name in enumerate(slide_names, start=1):
            texts = extract_text_from_xml(archive.read(slide_name))
            if texts:
                chunks.append(f'[Slide {slide_index}]')
                chunks.append('\n'.join(texts))
        note_names = sorted(
            (name for name in archive.namelist() if name.startswith('ppt/notesSlides/notesSlide') and name.endswith('.xml')),
            key=slide_sort_key,
        )
        for note_index, note_name in enumerate(note_names, start=1):
            texts = extract_text_from_xml(archive.read(note_name))
            if texts:
                chunks.append(f'[Notes {note_index}]')
                chunks.append('\n'.join(texts))
    return normalize_text('\n\n'.join(chunks))


def read_pdf_text(path: Path) -> str:
    if shutil.which('pdftotext') is None:
        raise RuntimeError('pdftotext is required to extract PDF text.')
    completed = subprocess.run(
        ['pdftotext', '-layout', '-enc', 'UTF-8', str(path), '-'],
        check=True,
        capture_output=True,
        text=True,
    )
    return normalize_text(completed.stdout)


def read_ppt_text(path: Path) -> str:
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if soffice is None:
        raise RuntimeError('LibreOffice or soffice is required to extract PPT text.')
    with tempfile.TemporaryDirectory(prefix='ppt_to_text_') as temp_dir:
        temp_path = Path(temp_dir)
        subprocess.run(
            [soffice, '--headless', '--convert-to', 'pptx', '--outdir', str(temp_path), str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
        converted = temp_path / f'{path.stem}.pptx'
        if not converted.exists():
            matches = list(temp_path.glob('*.pptx'))
            if not matches:
                raise RuntimeError(f'Failed to convert PPT to PPTX: {path}')
            converted = matches[0]
        return read_pptx_text(converted)


def read_reference_file(path: str | Path) -> str:
    file_path = Path(path)
    if not file_path.exists() or not file_path.is_file():
        raise FileNotFoundError(file_path)
    suffix = file_path.suffix.lower()
    if suffix not in SUPPORTED_REFERENCE_EXTENSIONS:
        raise ValueError(f'Unsupported reference file extension: {suffix}')
    if suffix in {'.txt', '.md'}:
        return normalize_text(file_path.read_text(encoding='utf-8'))
    if suffix == '.pdf':
        return read_pdf_text(file_path)
    if suffix == '.pptx':
        return read_pptx_text(file_path)
    if suffix == '.ppt':
        return read_ppt_text(file_path)
    raise ValueError(f'Unsupported reference file extension: {suffix}')


def load_json(path: str | Path) -> object:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def as_key_list(value: object, fallback: list[str]) -> list[str]:
    if value is None:
        return fallback
    if isinstance(value, str):
        return [value]
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    return fallback


def first_present(item: dict, keys: list[str], default: object = '') -> object:
    for key in keys:
        if key in item and item[key] not in (None, ''):
            return item[key]
    return default


def load_sentences(path: str | Path, config: dict) -> list[dict]:
    data = load_json(path)
    raw_sentences = data.get('sentences', []) if isinstance(data, dict) else data
    if not isinstance(raw_sentences, list):
        raise ValueError('Transcript JSON must be a list or contain a sentences list.')

    mapping = config.get('input_mapping', {}) if isinstance(config.get('input_mapping', {}), dict) else {}
    field_keys = {
        'index': as_key_list(mapping.get('index'), ['index', 'seq', 'sequence', 'turn']),
        'speaker': as_key_list(mapping.get('speaker'), ['speaker', 'speaker_name', 'speakerName', 'participant', 'role']),
        'time': as_key_list(mapping.get('time'), ['time', 'timestamp', 'time_range', 'range']),
        'content': as_key_list(mapping.get('content'), ['content', 'text', 'utterance', 'sentence', 'message']),
    }

    normalized: list[dict] = []
    for position, item in enumerate(raw_sentences, start=1):
        if not isinstance(item, dict):
            continue
        content = str(first_present(item, field_keys['content'], '')).strip()
        if not content:
            continue
        normalized.append(
            {
                'index': first_present(item, field_keys['index'], position),
                'speaker': str(first_present(item, field_keys['speaker'], 'Unknown')).strip() or 'Unknown',
                'time': str(first_present(item, field_keys['time'], '')).strip(),
                'content': content,
            }
        )
    return normalized


def format_transcript(sentences: list[dict]) -> str:
    lines: list[str] = []
    for sentence in sentences:
        index = sentence.get('index', '')
        speaker = sentence.get('speaker', 'Unknown')
        time = sentence.get('time', '')
        content = str(sentence.get('content', '')).strip()
        if not content:
            continue
        lines.append(f'[{index}] {speaker} ({time}): {content}')
    return '\n'.join(lines)


def list_block(title: str, items: object) -> str:
    if not items:
        return f'{title}: None specified.'
    if isinstance(items, str):
        return f'{title}: {items.strip()}'
    if isinstance(items, list):
        values = [str(item).strip() for item in items if str(item).strip()]
        if values:
            return title + ':\n' + '\n'.join(f'- {item}' for item in values)
    return f'{title}: {items}'


def load_special_instruction(value: str) -> str:
    if not value:
        return ''
    candidate = Path(value)
    if candidate.exists() and candidate.is_file():
        return candidate.read_text(encoding='utf-8').strip()
    return value.strip()


def build_prompt(transcript_text: str, config: dict, special_instruction: str, reference_text: str) -> str:
    document_type = str(config.get('document_type', 'Grounded report')).strip() or 'Grounded report'
    sections = config.get('sections') if isinstance(config.get('sections'), list) else DEFAULT_SECTIONS
    section_lines = '\n'.join(f'- {section}' for section in sections)
    output_format = str(config.get('output_format', 'Markdown')).strip() or 'Markdown'
    uncertainty_phrase = str(config.get('uncertainty_phrase', 'Needs confirmation')).strip() or 'Needs confirmation'
    action_policy = str(config.get('action_item_policy', 'Include only action items with an owner and a concrete task; use the uncertainty phrase for missing due dates.')).strip()
    reference_block = reference_text.strip() or 'No reference context was provided.'
    instruction_block = special_instruction.strip() or 'No extra instruction was provided.'
    system_context = str(config.get('system_context', '')).strip()

    return f'''You are generating a {document_type} from a speaker-attributed transcript.

The transcript is the primary evidence. Do not add facts, decisions, owners, dates, numbers, or action items that are not supported by the transcript. If something is implied but not explicit, mark it as {uncertainty_phrase}. Reference context may help interpret terminology, acronyms, and background, but it is not independent evidence for a claim absent from the transcript.

Output format: {output_format}
Return only the Markdown body. Do not wrap the answer in a code block.

Required sections:
{section_lines}

{list_block('Writing rules', config.get('rules'))}

{list_block('Include only content matching these criteria', config.get('inclusion_criteria'))}

{list_block('Exclude content matching these criteria', config.get('exclusion_criteria'))}

Action item policy:
{action_policy}

Additional system context:
{system_context or 'None specified.'}

User writing instruction:
{instruction_block}

Reference context:
{reference_block}

Grounded transcript:
{transcript_text}
'''


def call_llm(prompt: str, temperature: float | None) -> str:
    api_key = os.getenv('OPENAI_API_KEY', '')
    base_url = os.getenv('OPENAI_BASE_URL', '')
    api_version = os.getenv('OPENAI_API_VERSION', '2025-04-01-preview')
    model = os.getenv('OPENAI_MODEL', 'gpt-4o')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY is required unless --dry-run or --validate-only is used.')
    if not base_url:
        raise RuntimeError('OPENAI_BASE_URL is required unless --dry-run or --validate-only is used.')

    from openai import AzureOpenAI

    client = AzureOpenAI(azure_endpoint=base_url, api_key=api_key, api_version=api_version)
    request = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
    }
    if temperature is not None:
        request['temperature'] = temperature
    response = client.chat.completions.create(**request)
    return response.choices[0].message.content.strip()


def validate_inputs(sentences: list[dict], transcript_text: str, prompt: str, max_prompt_chars: int) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    if not sentences:
        errors.append('No usable transcript sentences were found.')
    if not transcript_text.strip():
        errors.append('Formatted transcript is empty.')
    unknown_speakers = sum(1 for item in sentences if item.get('speaker') == 'Unknown')
    if unknown_speakers:
        warnings.append(f'{unknown_speakers} utterance(s) have Unknown speaker.')
    missing_time = sum(1 for item in sentences if not item.get('time'))
    if missing_time:
        warnings.append(f'{missing_time} utterance(s) are missing time information.')
    if len(prompt) > max_prompt_chars:
        errors.append(f'Prompt length {len(prompt)} exceeds --max-prompt-chars {max_prompt_chars}.')
    return {'errors': errors, 'warnings': warnings, 'sentence_count': len(sentences), 'prompt_chars': len(prompt)}


def validate_markdown(markdown: str, sections: list[str], strict_headings: bool) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    if not markdown.strip():
        errors.append('Generated Markdown is empty.')
    if '```' in markdown:
        warnings.append('Generated Markdown contains code fences; confirm this is intended.')
    lower_markdown = markdown.lower()
    for section in sections:
        section_text = str(section).strip()
        if not section_text:
            continue
        has_heading = f'## {section_text}'.lower() in lower_markdown or f'### {section_text}'.lower() in lower_markdown
        if not has_heading:
            message = f'Missing expected Markdown heading: {section_text}'
            if strict_headings:
                errors.append(message)
            else:
                warnings.append(message)
    return {'errors': errors, 'warnings': warnings, 'output_chars': len(markdown)}


def write_validation(path: str | None, payload: dict) -> None:
    if not path:
        return
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def collect_reference_text(reference_text_paths: list[str], reference_file_paths: list[str]) -> str:
    parts: list[str] = []
    for path in reference_text_paths:
        text_path = Path(path)
        if not text_path.exists() or not text_path.is_file():
            raise FileNotFoundError(text_path)
        text = normalize_text(text_path.read_text(encoding='utf-8'))
        if text:
            parts.append(f'[Reference text: {text_path.name}]\n{text}')
    for path in reference_file_paths:
        file_path = Path(path)
        text = read_reference_file(file_path)
        if text:
            parts.append(f'[Reference file: {file_path.name}]\n{text}')
    return '\n\n'.join(parts).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate a grounded Markdown report from transcript JSON.')
    parser.add_argument('--transcript', required=True, help='Path to transcript JSON list or object containing a sentences list.')
    parser.add_argument('--config', required=True, help='Path to report contract config JSON.')
    parser.add_argument('--output', required=True, help='Path where the generated Markdown report should be written.')
    parser.add_argument('--special-instruction', default='', help='Inline instruction text or a path to a text file containing instructions.')
    parser.add_argument('--reference-text', action='append', default=[], help='Path to a UTF-8 text/Markdown context file. Can be repeated.')
    parser.add_argument('--reference-file', action='append', default=[], help='Path to a PDF, PPTX, PPT, TXT, or MD reference file. Can be repeated.')
    parser.add_argument('--env-file', default='.env', help='Optional .env file for LLM settings. Defaults to .env.')
    parser.add_argument('--temperature', type=float, default=0.0, help='LLM temperature. Defaults to 0.0.')
    parser.add_argument('--max-prompt-chars', type=int, default=120000, help='Fail if the assembled prompt exceeds this character count.')
    parser.add_argument('--validation-output', default='', help='Optional path for validation JSON.')
    parser.add_argument('--strict-headings', action='store_true', help='Fail when generated Markdown is missing configured section headings.')
    parser.add_argument('--dry-run', action='store_true', help='Build and validate the prompt without calling the LLM.')
    parser.add_argument('--print-prompt', action='store_true', help='Print the assembled prompt to stdout. Often used with --dry-run.')
    parser.add_argument('--validate-only', action='store_true', help='Validate transcript/config/reference inputs without calling the LLM.')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        load_env_file(args.env_file)
        config = load_json(args.config)
        if not isinstance(config, dict):
            raise ValueError('Config JSON must be an object.')
        sentences = load_sentences(args.transcript, config)
        transcript_text = format_transcript(sentences)
        reference_text = collect_reference_text(args.reference_text, args.reference_file)
        special_instruction = load_special_instruction(args.special_instruction)
        prompt = build_prompt(transcript_text, config, special_instruction, reference_text)
        sections = config.get('sections') if isinstance(config.get('sections'), list) else DEFAULT_SECTIONS
        input_validation = validate_inputs(sentences, transcript_text, prompt, args.max_prompt_chars)

        if args.print_prompt:
            print(prompt)

        if args.validate_only or args.dry_run:
            validation = {'input': input_validation, 'output': None}
            write_validation(args.validation_output, validation)
            if input_validation['errors']:
                print('Validation failed.', file=sys.stderr)
                for error in input_validation['errors']:
                    print(f'- {error}', file=sys.stderr)
                return 2
            print('Validation completed without blocking errors.')
            return 0

        if input_validation['errors']:
            write_validation(args.validation_output, {'input': input_validation, 'output': None})
            for error in input_validation['errors']:
                print(f'Input error: {error}', file=sys.stderr)
            return 2

        markdown = call_llm(prompt, args.temperature)
        output_validation = validate_markdown(markdown, [str(item) for item in sections], args.strict_headings)
        validation = {'input': input_validation, 'output': output_validation}
        write_validation(args.validation_output, validation)

        if output_validation['errors']:
            for error in output_validation['errors']:
                print(f'Output error: {error}', file=sys.stderr)
            return 3

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(markdown.rstrip() + '\n', encoding='utf-8')
        for warning in input_validation['warnings'] + output_validation['warnings']:
            print(f'Warning: {warning}', file=sys.stderr)
        print(f'Wrote grounded report: {output_path}')
        return 0
    except Exception as exc:
        print(f'Failed: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
