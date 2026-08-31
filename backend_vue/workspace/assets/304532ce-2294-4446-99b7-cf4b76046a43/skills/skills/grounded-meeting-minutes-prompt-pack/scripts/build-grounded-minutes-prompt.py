#!/usr/bin/env python3
"""Build a grounded meeting-minutes prompt from a transcript and JSON config."""

import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_SECTIONS = [
    'Meeting summary',
    'Main agenda',
    'Key discussion',
    'Decisions',
    'Action items',
    'Issues and risks',
    'Key Q&A'
]


def read_text(path):
    return Path(path).read_text(encoding='utf-8')


def load_config(path):
    if not path:
        return {}
    try:
        data = json.loads(read_text(path))
    except json.JSONDecodeError as exc:
        raise SystemExit(f'Config JSON is invalid: {exc}')
    if not isinstance(data, dict):
        raise SystemExit('Config JSON must be an object.')
    return data


def as_list(value, default=None):
    if value is None:
        return list(default or [])
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [line.strip('- ').strip() for line in value.splitlines() if line.strip()]
    return [str(value).strip()] if str(value).strip() else list(default or [])


def bullet_list(items):
    return '\n'.join(f'- {item}' for item in items) if items else '- None specified'


def transcript_format_warning(transcript):
    lines = [line for line in transcript.splitlines() if line.strip()]
    if not lines:
        raise SystemExit('Transcript is empty.')
    sampled = lines[: min(20, len(lines))]
    pattern = re.compile(r'^\s*\[?\d*\]?\s*[^:]{1,80}\([^)]{1,80}\):\s+.+')
    matches = sum(1 for line in sampled if pattern.search(line))
    if matches < max(1, len(sampled) // 4):
        return 'Warning: transcript does not look consistently speaker/time-stamped. Continue only if the format is intentional.'
    return None


def build_prompt(transcript, config, extra_instruction):
    purpose = str(config.get('purpose', 'Create grounded business minutes from the transcript.')).strip()
    output_language = str(config.get('output_language', 'same language as the transcript')).strip()
    tone = str(config.get('tone', 'concise, neutral, business-ready')).strip()
    required_sections = as_list(config.get('required_sections'), DEFAULT_SECTIONS)
    exclude_criteria = as_list(config.get('exclude_criteria'), [
        'Greetings, closings, and small talk',
        'Simple acknowledgements without business impact',
        'Repeated statements that do not change the conclusion',
        'Unintelligible STT fragments'
    ])
    action_rules = as_list(config.get('action_item_rules'), [
        'Include only tasks explicitly agreed in the transcript.',
        'Each action item must have an owner and task.',
        'Use confirmation needed when the deadline is absent or ambiguous.',
        'Do not convert vague suggestions into action items.'
    ])
    special = str(config.get('special_instruction', '')).strip()
    if extra_instruction:
        special = (special + '\n' + extra_instruction).strip()
    if not special:
        special = 'None.'

    return f'''You are generating grounded business minutes.

Purpose: {purpose}
Output language: {output_language}
Document tone: {tone}

The transcript is the only evidence source. Do not add facts, decisions, owners, dates, numbers, or context that are not supported by the transcript. If something is ambiguous, write confirmation needed instead of guessing.

Special instructions:
{special}

Required sections:
{bullet_list(required_sections)}

Include content only when it is relevant to at least one of these outcomes:
- Main agenda or business objective
- Decision made or decision deferred
- Owner-assigned follow-up work
- Issue, risk, blocker, or disagreement
- Background that absent stakeholders need to understand the outcome
- Q&A connected to a decision, issue, or action item

Exclude:
{bullet_list(exclude_criteria)}

Action item rules:
{bullet_list(action_rules)}

Markdown rules:
- Return only the Markdown body.
- Use ## and ### headings.
- Use tables when they make decisions, risks, or action items easier to review.
- Do not create a section that lists every speaker's remarks.
- Mention a speaker only when the speaker identity is important to a decision, commitment, issue, or question.

Transcript:
{transcript}
'''


def main():
    parser = argparse.ArgumentParser(description='Build a grounded prompt for structured meeting minutes.')
    parser.add_argument('--transcript', required=True, help='Path to the speaker/time-stamped transcript text file.')
    parser.add_argument('--config', required=True, help='Path to a JSON config file for prompt rules.')
    parser.add_argument('--output', required=True, help='Path to write the generated prompt text.')
    parser.add_argument('--instruction', default='', help='Optional one-off instruction to append to the config instructions.')
    args = parser.parse_args()

    transcript = read_text(args.transcript).strip()
    warning = transcript_format_warning(transcript)
    config = load_config(args.config)
    prompt = build_prompt(transcript, config, args.instruction)
    Path(args.output).write_text(prompt, encoding='utf-8')
    if warning:
        print(warning, file=sys.stderr)
    print(f'Prompt written to {args.output}')


if __name__ == '__main__':
    main()
