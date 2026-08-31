#!/usr/bin/env python3
"""Heuristically check whether generated minutes stay grounded in the transcript."""

import argparse
import json
import re
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

STOPWORDS = {
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'were',
    'meeting', 'summary', 'agenda', 'discussion', 'decisions', 'decision', 'action',
    'items', 'issues', 'risks', 'risk', 'owner', 'task', 'deadline', 'status', 'needed',
    'confirmation', 'table', 'section', 'key', 'main', 'qa', 'q', 'a'
}


def read_text(path):
    return Path(path).read_text(encoding='utf-8')


def load_config(path):
    if not path:
        return {}
    data = json.loads(read_text(path))
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


def normalize_heading(value):
    return re.sub(r'[^0-9A-Za-z가-힣]+', '', value).lower()


def extract_headings(markdown):
    return [m.group(1).strip() for m in re.finditer(r'^\s{0,3}#{1,6}\s+(.+?)\s*$', markdown, re.MULTILINE)]


def tokenize(text):
    raw = re.findall(r'[0-9A-Za-z가-힣][0-9A-Za-z가-힣._%/-]*', text.lower())
    return [t for t in raw if len(t) >= 2 and t not in STOPWORDS]


def extract_numbers(text):
    return set(re.findall(r'\b\d{1,4}(?:[./:-]\d{1,2})*(?:%|명|개|건|원|달러|일|월|년)?\b', text))


def find_section(markdown, keywords):
    lines = markdown.splitlines()
    start = None
    for i, line in enumerate(lines):
        m = re.match(r'^\s{0,3}#{1,6}\s+(.+?)\s*$', line)
        if m and any(k in m.group(1).lower() for k in keywords):
            start = i + 1
            break
    if start is None:
        return ''
    end = len(lines)
    for j in range(start, len(lines)):
        if re.match(r'^\s{0,3}#{1,6}\s+', lines[j]):
            end = j
            break
    return '\n'.join(lines[start:end])


def check_action_table(markdown):
    section = find_section(markdown, ['action', 'follow-up', 'task'])
    if not section.strip():
        return ['Action item section was not found or is empty.']
    table_lines = [line for line in section.splitlines() if '|' in line]
    data_lines = [line for line in table_lines if not re.search(r'^\s*\|?\s*:?-{3,}', line)]
    if len(data_lines) < 2:
        return ['Action items should use a table with at least a header and one data row, or explicitly state that there are no confirmed action items.']
    header = data_lines[0].lower()
    issues = []
    if not any(word in header for word in ['owner', 'assignee', 'responsible', '담당']):
        issues.append('Action item table header should include an owner/responsible column.')
    if not any(word in header for word in ['task', 'action', 'work', '할 일', '조치']):
        issues.append('Action item table header should include a task/action column.')
    if not any(word in header for word in ['deadline', 'due', 'date', '기한']):
        issues.append('Action item table header should include a deadline/due-date column or confirmation-needed status.')
    return issues


def main():
    parser = argparse.ArgumentParser(description='Check generated minutes for required sections and transcript grounding.')
    parser.add_argument('--transcript', required=True, help='Path to the source transcript text file.')
    parser.add_argument('--minutes', required=True, help='Path to the generated Markdown minutes file.')
    parser.add_argument('--config', required=False, help='Optional JSON config with required_sections.')
    parser.add_argument('--report-output', required=False, help='Optional path to write a JSON validation report.')
    parser.add_argument('--min-grounding-score', type=float, default=0.55, help='Minimum ratio of significant minutes tokens also found in the transcript.')
    args = parser.parse_args()

    transcript = read_text(args.transcript)
    minutes = read_text(args.minutes)
    config = load_config(args.config) if args.config else {}
    required_sections = as_list(config.get('required_sections'), DEFAULT_SECTIONS)

    headings = extract_headings(minutes)
    normalized_headings = [normalize_heading(h) for h in headings]
    missing_sections = []
    for section in required_sections:
        target = normalize_heading(section)
        if target and not any(target in h or h in target for h in normalized_headings):
            missing_sections.append(section)

    transcript_tokens = set(tokenize(transcript))
    minute_tokens = tokenize(minutes)
    unsupported = sorted({t for t in minute_tokens if t not in transcript_tokens and not t.isdigit()})
    grounding_score = 1.0 if not minute_tokens else round((len(minute_tokens) - len(unsupported)) / len(minute_tokens), 3)

    transcript_numbers = extract_numbers(transcript)
    minute_numbers = extract_numbers(minutes)
    unsupported_numbers = sorted(minute_numbers - transcript_numbers)

    issues = []
    if missing_sections:
        issues.append({'type': 'missing_sections', 'items': missing_sections})
    if grounding_score < args.min_grounding_score:
        issues.append({'type': 'low_grounding_score', 'score': grounding_score, 'threshold': args.min_grounding_score})
    if unsupported_numbers:
        issues.append({'type': 'unsupported_numbers_or_dates', 'items': unsupported_numbers})
    action_issues = check_action_table(minutes) if any('action' in s.lower() or 'follow' in s.lower() for s in required_sections) else []
    if action_issues:
        issues.append({'type': 'action_item_format', 'items': action_issues})

    status = 'pass'
    if missing_sections or grounding_score < args.min_grounding_score:
        status = 'fail'
    elif issues or unsupported[:20]:
        status = 'warn'

    report = {
        'status': status,
        'grounding_score': grounding_score,
        'required_sections_checked': required_sections,
        'missing_sections': missing_sections,
        'unsupported_numbers_or_dates': unsupported_numbers,
        'sample_unsupported_terms': unsupported[:40],
        'issues': issues
    }

    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report_output:
        Path(args.report_output).write_text(text + '\n', encoding='utf-8')
    print(text)


if __name__ == '__main__':
    main()
