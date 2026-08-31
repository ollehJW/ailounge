#!/usr/bin/env python3
import argparse
import html
import json
import sqlite3
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

DEFAULT_CONFIG = {
    'roles': ['lead', 'member'],
    'work_roles': ['owner', 'participant'],
    'report_states': ['pending', 'progress', 'done', 'absent'],
    'work_states': ['in_progress', 'done'],
    'event_types': ['team', 'vacation', 'training', 'trip', 'personal'],
    'risk_levels': ['high', 'medium', 'low']
}

SCHEMA = '''
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS organizations (
  org_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  member_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_units (
  work_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_members (
  work_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (work_id, member_id),
  FOREIGN KEY (work_id) REFERENCES work_units(work_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS milestones (
  milestone_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES work_units(work_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS event_members (
  event_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  PRIMARY KEY (event_id, member_id),
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reports (
  report_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS report_entries (
  entry_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(report_id, member_id),
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_entries (
  entry_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  is_excluded INTEGER NOT NULL DEFAULT 0,
  progress_log TEXT NOT NULL DEFAULT '[]',
  risk_issue TEXT NOT NULL DEFAULT '[]',
  next_plan TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, work_id),
  FOREIGN KEY (entry_id) REFERENCES report_entries(entry_id) ON DELETE CASCADE,
  FOREIGN KEY (work_id) REFERENCES work_units(work_id) ON DELETE CASCADE
);
'''


def now():
    return datetime.utcnow().isoformat(timespec='seconds')


def new_id():
    return str(uuid.uuid4())


def connect(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def load_json(path):
    with open(path, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def read_config(path):
    if not path:
        return dict(DEFAULT_CONFIG)
    cfg = load_json(path)
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    return merged


def require_list(cfg, key):
    value = cfg.get(key)
    if not isinstance(value, list) or not value or not all(isinstance(item, str) and item.strip() for item in value):
        raise ValueError(f'{key} must be a non-empty list of strings')


def validate_config(args):
    cfg = read_config(args.config)
    for key in ['roles', 'work_roles', 'report_states', 'work_states', 'event_types', 'risk_levels']:
        require_list(cfg, key)
    required_report_states = {'pending', 'progress', 'done', 'absent'}
    missing = required_report_states.difference(set(cfg['report_states']))
    if missing:
        raise ValueError('report_states must include: ' + ', '.join(sorted(missing)))
    print('Configuration is valid.')


def init_db(args):
    if args.config:
        validate_config(args)
    with connect(args.db) as conn:
        conn.executescript(SCHEMA)
    print(f'Database initialized: {args.db}')


def parse_iso(value, field):
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f'{field} must use YYYY-MM-DD') from exc


def ensure_range(start_text, end_text):
    start = parse_iso(start_text, 'start_date')
    end = parse_iso(end_text, 'end_date')
    if end < start:
        raise ValueError('end_date must be on or after start_date')
    cursor = start
    while cursor <= end:
        if cursor.weekday() < 5:
            return
        cursor += timedelta(days=1)
    raise ValueError('date range must include at least one weekday')


def insert_many(conn, table, rows, columns):
    count = 0
    for row in rows:
        values = [row.get(column) for column in columns]
        marks = ','.join(['?'] * len(columns))
        names = ','.join(columns)
        conn.execute(f'INSERT OR REPLACE INTO {table} ({names}) VALUES ({marks})', values)
        count += 1
    return count


def import_seed(args):
    seed = load_json(args.seed)
    ts = now()
    with connect(args.db) as conn:
        orgs = []
        for item in seed.get('organizations', []):
            orgs.append({'org_id': item.get('org_id') or new_id(), 'name': item['name'], 'created_at': item.get('created_at') or ts})
        members = []
        for item in seed.get('members', []):
            members.append({'member_id': item.get('member_id') or new_id(), 'org_id': item['org_id'], 'name': item['name'], 'role': item.get('role', 'member'), 'sort_order': item.get('sort_order', 0), 'created_at': item.get('created_at') or ts})
        works = []
        for item in seed.get('work_units', []):
            works.append({'work_id': item.get('work_id') or new_id(), 'org_id': item['org_id'], 'title': item['title'], 'status': item.get('status', 'in_progress'), 'created_at': item.get('created_at') or ts})
        milestones = []
        for item in seed.get('milestones', []):
            ensure_range(item['start_date'], item['end_date'])
            milestones.append({'milestone_id': item.get('milestone_id') or new_id(), 'work_id': item['work_id'], 'title': item['title'], 'start_date': item['start_date'], 'end_date': item['end_date'], 'created_at': item.get('created_at') or ts})
        events = []
        for item in seed.get('events', []):
            ensure_range(item['start_date'], item['end_date'])
            events.append({'event_id': item.get('event_id') or new_id(), 'org_id': item['org_id'], 'title': item['title'], 'event_type': item.get('event_type', 'team'), 'start_date': item['start_date'], 'end_date': item['end_date'], 'created_at': item.get('created_at') or ts})
        counts = {
            'organizations': insert_many(conn, 'organizations', orgs, ['org_id', 'name', 'created_at']),
            'members': insert_many(conn, 'members', members, ['member_id', 'org_id', 'name', 'role', 'sort_order', 'created_at']),
            'work_units': insert_many(conn, 'work_units', works, ['work_id', 'org_id', 'title', 'status', 'created_at']),
            'milestones': insert_many(conn, 'milestones', milestones, ['milestone_id', 'work_id', 'title', 'start_date', 'end_date', 'created_at']),
            'events': insert_many(conn, 'events', events, ['event_id', 'org_id', 'title', 'event_type', 'start_date', 'end_date', 'created_at'])
        }
        for item in seed.get('work_members', []):
            conn.execute('INSERT OR REPLACE INTO work_members (work_id, member_id, role) VALUES (?, ?, ?)', (item['work_id'], item['member_id'], item.get('role', 'participant')))
            counts['work_members'] = counts.get('work_members', 0) + 1
        for item in seed.get('event_members', []):
            conn.execute('INSERT OR REPLACE INTO event_members (event_id, member_id) VALUES (?, ?)', (item['event_id'], item['member_id']))
            counts['event_members'] = counts.get('event_members', 0) + 1
    print('Seed imported: ' + json.dumps(counts, ensure_ascii=False, sort_keys=True))


def ensure_one(conn, sql, params, message):
    row = conn.execute(sql, params).fetchone()
    if not row:
        raise ValueError(message)
    return row


def open_report(args):
    ensure_range(args.start_date, args.end_date)
    with connect(args.db) as conn:
        ensure_one(conn, 'SELECT * FROM organizations WHERE org_id = ?', (args.org_id,), 'Organization not found')
        existing = conn.execute('SELECT report_id FROM reports WHERE org_id = ? AND status = ?', (args.org_id, 'in_progress')).fetchone()
        if existing:
            raise ValueError('An in-progress report already exists for this organization')
        report_id = new_id()
        conn.execute('INSERT INTO reports (report_id, org_id, start_date, end_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', (report_id, args.org_id, args.start_date, args.end_date, 'in_progress', now()))
    print(report_id)


def ensure_member_entry(conn, report_id, member_id):
    report = ensure_one(conn, 'SELECT * FROM reports WHERE report_id = ?', (report_id,), 'Report not found')
    member = ensure_one(conn, 'SELECT * FROM members WHERE member_id = ? AND org_id = ?', (member_id, report['org_id']), 'Member not found in report organization')
    entry = conn.execute('SELECT * FROM report_entries WHERE report_id = ? AND member_id = ?', (report_id, member_id)).fetchone()
    ts = now()
    if not entry:
        entry_id = new_id()
        conn.execute('INSERT INTO report_entries (entry_id, report_id, member_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', (entry_id, report_id, member_id, 'pending', ts, ts))
    else:
        entry_id = entry['entry_id']
    works = conn.execute('''
      SELECT wu.work_id FROM work_units wu
      JOIN work_members wm ON wm.work_id = wu.work_id
      WHERE wm.member_id = ? AND wu.org_id = ? AND wu.status = 'in_progress'
    ''', (member_id, report['org_id'])).fetchall()
    for work in works:
        conn.execute('INSERT OR IGNORE INTO work_entries (entry_id, work_id, is_excluded, progress_log, risk_issue, next_plan, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?)', (entry_id, work['work_id'], '[]', '[]', '[]', ts))
    return conn.execute('SELECT * FROM report_entries WHERE entry_id = ?', (entry_id,)).fetchone(), member, report


def parse_list(value):
    if value is None or value == '':
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    return []


def normalize_payload(payload):
    progress = []
    for item in parse_list(payload.get('progress_log')):
        if isinstance(item, str):
            log = item.strip(); status = 'done'; item_date = ''
        else:
            log = str(item.get('log') or item.get('text') or '').strip()
            status = 'in_progress' if item.get('status') == 'in_progress' else 'done'
            item_date = str(item.get('date') or '').strip().replace('-', '/')
        if log or item_date:
            progress.append({'log': log, 'status': status, 'date': item_date})
    risks = []
    for item in parse_list(payload.get('risk_issue')):
        if isinstance(item, str):
            issue = item.strip(); importance = 'medium'
        else:
            issue = str(item.get('issue') or '').strip()
            importance = str(item.get('importance') or 'medium').strip()
        if issue:
            risks.append({'issue': issue, 'importance': importance})
    plans = []
    for item in parse_list(payload.get('next_plan')):
        if isinstance(item, str):
            plan = item.strip(); due = ''
        else:
            plan = str(item.get('plan') or '').strip()
            due = str(item.get('due') or '').strip().replace('-', '/')
        if plan or due:
            plans.append({'plan': plan, 'due': due})
    return {'progress_log': progress, 'risk_issue': risks, 'next_plan': plans}


def work_entry_has_content(row):
    return bool(json.loads(row['progress_log']) or json.loads(row['risk_issue']) or json.loads(row['next_plan']))


def work_entry_status(row):
    if row['is_excluded']:
        return 'excluded'
    return 'done' if work_entry_has_content(row) else 'pending'


def recompute_entry_status(conn, entry_id):
    entry = ensure_one(conn, 'SELECT * FROM report_entries WHERE entry_id = ?', (entry_id,), 'Report entry not found')
    if entry['status'] == 'absent':
        return entry
    rows = conn.execute('SELECT * FROM work_entries WHERE entry_id = ?', (entry_id,)).fetchall()
    statuses = [work_entry_status(row) for row in rows]
    if statuses and all(status in ('done', 'excluded') for status in statuses):
        next_status = 'done'
    elif any(status in ('done', 'excluded') for status in statuses):
        next_status = 'progress'
    else:
        next_status = 'pending'
    conn.execute('UPDATE report_entries SET status = ?, updated_at = ? WHERE entry_id = ?', (next_status, now(), entry_id))
    return conn.execute('SELECT * FROM report_entries WHERE entry_id = ?', (entry_id,)).fetchone()


def submit_entry(args):
    payload = normalize_payload(load_json(args.entry_file))
    with connect(args.db) as conn:
        entry, member, report = ensure_member_entry(conn, args.report_id, args.member_id)
        assignment = conn.execute('SELECT 1 FROM work_members WHERE work_id = ? AND member_id = ?', (args.work_id, args.member_id)).fetchone()
        if not assignment:
            raise ValueError('Member is not assigned to the selected work unit')
        exists = conn.execute('SELECT 1 FROM work_entries WHERE entry_id = ? AND work_id = ?', (entry['entry_id'], args.work_id)).fetchone()
        if not exists:
            conn.execute('INSERT INTO work_entries (entry_id, work_id, is_excluded, progress_log, risk_issue, next_plan, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?)', (entry['entry_id'], args.work_id, '[]', '[]', '[]', now()))
        conn.execute('''
          UPDATE work_entries SET is_excluded = 0, progress_log = ?, risk_issue = ?, next_plan = ?, updated_at = ?
          WHERE entry_id = ? AND work_id = ?
        ''', (json.dumps(payload['progress_log'], ensure_ascii=False), json.dumps(payload['risk_issue'], ensure_ascii=False), json.dumps(payload['next_plan'], ensure_ascii=False), now(), entry['entry_id'], args.work_id))
        updated = recompute_entry_status(conn, entry['entry_id'])
    print(updated['status'])


def parse_bool(value):
    text = str(value).lower().strip()
    if text in ('1', 'true', 'yes', 'y'):
        return True
    if text in ('0', 'false', 'no', 'n'):
        return False
    raise argparse.ArgumentTypeError('Expected true or false')


def set_absence(args):
    with connect(args.db) as conn:
        entry, member, report = ensure_member_entry(conn, args.report_id, args.member_id)
        if args.absent:
            conn.execute('UPDATE report_entries SET status = ?, updated_at = ? WHERE entry_id = ?', ('absent', now(), entry['entry_id']))
            status = 'absent'
        else:
            status = recompute_entry_status(conn, entry['entry_id'])['status']
    print(status)


def set_exclusion(args):
    with connect(args.db) as conn:
        entry, member, report = ensure_member_entry(conn, args.report_id, args.member_id)
        exists = conn.execute('SELECT 1 FROM work_entries WHERE entry_id = ? AND work_id = ?', (entry['entry_id'], args.work_id)).fetchone()
        if not exists:
            raise ValueError('Work entry not found for member')
        if args.excluded:
            conn.execute('UPDATE work_entries SET is_excluded = 1, progress_log = ?, risk_issue = ?, next_plan = ?, updated_at = ? WHERE entry_id = ? AND work_id = ?', ('[]', '[]', '[]', now(), entry['entry_id'], args.work_id))
        else:
            conn.execute('UPDATE work_entries SET is_excluded = 0, updated_at = ? WHERE entry_id = ? AND work_id = ?', (now(), entry['entry_id'], args.work_id))
        updated = recompute_entry_status(conn, entry['entry_id'])
    print(updated['status'])


def check_report(args):
    with connect(args.db) as conn:
        report = ensure_one(conn, 'SELECT * FROM reports WHERE report_id = ?', (args.report_id,), 'Report not found')
        members = conn.execute('SELECT member_id FROM members WHERE org_id = ? ORDER BY sort_order, name', (report['org_id'],)).fetchall()
        for member in members:
            ensure_member_entry(conn, args.report_id, member['member_id'])
        rows = conn.execute('''
          SELECT re.status, COUNT(*) AS count FROM report_entries re
          WHERE re.report_id = ? GROUP BY re.status ORDER BY re.status
        ''', (args.report_id,)).fetchall()
        total = conn.execute('SELECT COUNT(*) AS count FROM members WHERE org_id = ?', (report['org_id'],)).fetchone()['count']
        summary = {row['status']: row['count'] for row in rows}
        summary['total_members'] = total
        summary['ready_to_complete'] = summary.get('pending', 0) == 0 and summary.get('progress', 0) == 0
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))


def complete_report(args):
    with connect(args.db) as conn:
        report = ensure_one(conn, 'SELECT * FROM reports WHERE report_id = ?', (args.report_id,), 'Report not found')
        rows = conn.execute('SELECT status FROM report_entries WHERE report_id = ?', (args.report_id,)).fetchall()
        incomplete = [row['status'] for row in rows if row['status'] in ('pending', 'progress')]
        if incomplete:
            raise ValueError('Report has pending or in-progress member entries')
        conn.execute('UPDATE reports SET status = ? WHERE report_id = ?', ('completed', args.report_id))
    print('completed')


def esc(value):
    return html.escape(str(value or ''), quote=True)


def item_date(value):
    return str(value or '').replace('/', '.').replace('-', '.')


def render_list(items, kind):
    if not items:
        return '<p class=empty>No content.</p>'
    rows = []
    for item in items:
        if kind == 'progress':
            status = esc(item.get('status', 'done'))
            date_text = esc(item_date(item.get('date', '')))
            log = esc(item.get('log', ''))
            rows.append(f'<li><b>{status}</b> {date_text}<br>{log}</li>')
        elif kind == 'risk':
            level = esc(item.get('importance', 'medium'))
            issue = esc(item.get('issue', ''))
            rows.append(f'<li><b>{level}</b> {issue}</li>')
        else:
            due = esc(item_date(item.get('due', '')))
            plan = esc(item.get('plan', ''))
            rows.append(f'<li><b>{due}</b> {plan}</li>')
    return '<ul>' + ''.join(rows) + '</ul>'


def page(title, body):
    return '<!doctype html><html><head><meta charset=utf-8><title>' + esc(title) + '</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#20242a}article{border:1px solid #ddd;margin:16px 0;padding:16px}h1{margin-top:0}.meta{color:#667085}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}.empty{color:#888}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style></head><body>' + body + '</body></html>'


def render_member_report(args):
    with connect(args.db) as conn:
        report = ensure_one(conn, 'SELECT * FROM reports WHERE report_id = ?', (args.report_id,), 'Report not found')
        member = ensure_one(conn, 'SELECT * FROM members WHERE member_id = ?', (args.member_id,), 'Member not found')
        entry = conn.execute('SELECT * FROM report_entries WHERE report_id = ? AND member_id = ?', (args.report_id, args.member_id)).fetchone()
        if not entry:
            raise ValueError('Member entry not found')
        rows = conn.execute('''
          SELECT we.*, wu.title FROM work_entries we
          JOIN work_units wu ON wu.work_id = we.work_id
          WHERE we.entry_id = ? AND we.is_excluded = 0
          ORDER BY wu.created_at DESC, wu.title
        ''', (entry['entry_id'],)).fetchall()
        start = report['start_date']; end = report['end_date']
        body = f'<h1>Member report</h1><p class=meta>{esc(member['name'])} · {esc(start)} to {esc(end)} · status {esc(entry['status'])}</p>'
        if not rows:
            body += '<p class=empty>No visible work units.</p>'
        for row in rows:
            progress = json.loads(row['progress_log'])
            risks = json.loads(row['risk_issue'])
            plans = json.loads(row['next_plan'])
            title = esc(row['title'])
            body += f'<article><h2>{title}</h2><div class=grid><section><h3>Progress</h3>{render_list(progress, 'progress')}</section><section><h3>Risk and issue</h3>{render_list(risks, 'risk')}</section><section><h3>Next plan</h3>{render_list(plans, 'plan')}</section></div></article>'
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page('Member report', body), encoding='utf-8')
    print(f'Wrote {out}')


def render_work_report(args):
    with connect(args.db) as conn:
        report = ensure_one(conn, 'SELECT * FROM reports WHERE report_id = ?', (args.report_id,), 'Report not found')
        work = ensure_one(conn, 'SELECT * FROM work_units WHERE work_id = ?', (args.work_id,), 'Work unit not found')
        rows = conn.execute('''
          SELECT we.*, re.status AS member_status, m.name, m.role, m.sort_order FROM work_entries we
          JOIN report_entries re ON re.entry_id = we.entry_id
          JOIN members m ON m.member_id = re.member_id
          WHERE re.report_id = ? AND we.work_id = ? AND we.is_excluded = 0 AND re.status != 'absent'
          ORDER BY m.sort_order, m.name
        ''', (args.report_id, args.work_id)).fetchall()
        start = report['start_date']; end = report['end_date']
        body = f'<h1>Work-unit report</h1><p class=meta>{esc(work['title'])} · {esc(start)} to {esc(end)}</p>'
        if not rows:
            body += '<p class=empty>No submitted member content.</p>'
        for row in rows:
            progress = json.loads(row['progress_log'])
            risks = json.loads(row['risk_issue'])
            plans = json.loads(row['next_plan'])
            source = esc(row['name'])
            body += f'<article><h2>{source}</h2><div class=grid><section><h3>Progress</h3>{render_list(progress, 'progress')}</section><section><h3>Risk and issue</h3>{render_list(risks, 'risk')}</section><section><h3>Next plan</h3>{render_list(plans, 'plan')}</section></div></article>'
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page('Work-unit report', body), encoding='utf-8')
    print(f'Wrote {out}')


def build_parser():
    parser = argparse.ArgumentParser(description='Config-driven work reporting workspace skeleton')
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('validate-config', help='Validate reporting configuration')
    p.add_argument('--config', required=True)
    p.set_defaults(func=validate_config)
    p = sub.add_parser('init-db', help='Create SQLite schema')
    p.add_argument('--config')
    p.add_argument('--db', required=True)
    p.set_defaults(func=init_db)
    p = sub.add_parser('import-seed', help='Import seed data')
    p.add_argument('--db', required=True)
    p.add_argument('--seed', required=True)
    p.set_defaults(func=import_seed)
    p = sub.add_parser('open-report', help='Open a reporting period')
    p.add_argument('--db', required=True)
    p.add_argument('--org-id', required=True)
    p.add_argument('--start-date', required=True)
    p.add_argument('--end-date', required=True)
    p.set_defaults(func=open_report)
    p = sub.add_parser('submit-entry', help='Submit structured member work content')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.add_argument('--member-id', required=True)
    p.add_argument('--work-id', required=True)
    p.add_argument('--entry-file', required=True)
    p.set_defaults(func=submit_entry)
    p = sub.add_parser('set-absence', help='Set member absence for the whole report')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.add_argument('--member-id', required=True)
    p.add_argument('--absent', required=True, type=parse_bool)
    p.set_defaults(func=set_absence)
    p = sub.add_parser('set-exclusion', help='Exclude or include one work unit for a member entry')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.add_argument('--member-id', required=True)
    p.add_argument('--work-id', required=True)
    p.add_argument('--excluded', required=True, type=parse_bool)
    p.set_defaults(func=set_exclusion)
    p = sub.add_parser('check-report', help='Summarize readiness by member status')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.set_defaults(func=check_report)
    p = sub.add_parser('complete-report', help='Complete a report when all entries are ready')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.set_defaults(func=complete_report)
    p = sub.add_parser('render-member-report', help='Render HTML grouped by member')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.add_argument('--member-id', required=True)
    p.add_argument('--out', required=True)
    p.set_defaults(func=render_member_report)
    p = sub.add_parser('render-work-report', help='Render HTML grouped by work unit')
    p.add_argument('--db', required=True)
    p.add_argument('--report-id', required=True)
    p.add_argument('--work-id', required=True)
    p.add_argument('--out', required=True)
    p.set_defaults(func=render_work_report)
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except Exception as exc:
        print(f'Error: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
