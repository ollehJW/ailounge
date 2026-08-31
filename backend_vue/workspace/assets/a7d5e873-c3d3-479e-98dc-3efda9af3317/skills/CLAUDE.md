# Project Overview

This harness helps adapt the original asset's reusable pattern to other work areas: standardize work units and participants, collect structured status input, and render reusable reports/history from the same data.

The reference case is a weekly report management platform for tasks, milestones/work plans, team calendar context, absences/exclusions, member/project reports, and a report lounge for past history.

# Runtime and Environment

- Backend: Python FastAPI with SQLite inferred from `backend/main.py` and `requirements.txt`.
- Python: use Python 3.10+ as a recommended minimum unless the local repo specifies otherwise.
- Frontend: React inferred from `frontend/src/main.jsx` and `frontend/package.json`.
- Node.js: use Node.js 18+ as a recommended minimum for modern React tooling unless `package.json` specifies otherwise.
- Package managers: `pip` for Python dependencies and `npm` for frontend dependencies.
- Report rendering: HTML templates under `backend/templates/`.

Install:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install
```

# Common Commands

Run backend:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload
```

Run frontend:

```bash
cd frontend
npm run dev
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

# Repository Layout

- `CLAUDE.md`: compact session bootstrap and routing guide.
- `skills/<slug>/SKILL.md`: detailed adaptation guidance, workflow, validation, and examples.
- `skills/<slug>/scripts/`: optional helper scripts for a skill.
- Reference implementation files may include `backend/`, `frontend/`, `docs/`, and HTML report templates.

# Skill Routing

Open the relevant `skills/<slug>/SKILL.md` before doing detailed adaptation work.

- `config-driven-work-reporting-platform`: use when adapting the full workspace skeleton for teams, members, work units, schedules, report rounds, status tracking, and completion flows.
- `role-based-team-workspace-access`: use when adapting role boundaries, member/admin access, workspace permissions, and internal authentication assumptions.

# Safety Rules

- Do not embed credentials, tokens, API keys, passwords, or private data in code, prompts, commits, examples, or generated files.
- Do not use real employee, customer, project, or operational data unless explicitly approved and sanitized.
- Do not attempt unauthorized access, privilege escalation, scraping, or bypassing security controls.
- Do not execute against production systems, production databases, or live internal services without explicit approval.
- Prefer local mock data, sample users, and isolated development environments for adaptation and testing.
