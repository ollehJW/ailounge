# Project Overview

This harness helps Claude adapt the reusable pattern from the original AI asset to other work areas. Treat the original implementation as a reference case, then route into the relevant skill for adaptation guidance.

Reference case: a Meeting Minutes Auto Agent that takes meeting audio or recordings, performs speaker diarization and STT, corrects transcripts with context, and generates structured minutes for human review.

## Runtime and Environment

No locked runtime manifest is provided in this harness metadata. Use these recommended assumptions when creating or adapting implementations:

- Python: 3.10+ recommended for FastAPI, audio processing, STT/diarization, and LLM orchestration.
- Node.js: 18+ recommended for React-based frontend work.
- Python package manager: `pip` with `requirements.txt` or `pyproject.toml` when present.
- JavaScript package manager: `npm` with `package.json` when present.
- Reference backend stack: FastAPI, STT model integration, speaker diarization, Azure OpenAI-compatible LLM calls.
- Reference frontend stack: React for upload, progress, review, and download screens.
- Audio pipelines may require system tools such as `ffmpeg` and model-specific runtime setup.
- No Playwright/browser automation requirement is inferable unless added by a target repo.

## Common Commands

```bash
python --version
node --version
```

```bash
python -m venv .venv
source .venv/bin/activate
```

```bash
[ -f requirements.txt ] && pip install -r requirements.txt
[ -f pyproject.toml ] && pip install -e .
```

```bash
[ -f package.json ] && npm install
```

```bash
find skills -maxdepth 2 -name SKILL.md -print
sed -n '1,220p' skills/config-driven-audio-minutes-pipeline/SKILL.md
sed -n '1,220p' skills/grounded-meeting-minutes-prompt-pack/SKILL.md
```

## Repository Layout

- `CLAUDE.md`: compact session bootstrap and routing document.
- `skills/<slug>/SKILL.md`: detailed adaptation guidance, workflow, checklists, validation, and examples.
- `skills/<slug>/scripts/`: optional helper scripts or skeleton code for that skill.

Do not place detailed adaptation plans in this root file. Open the relevant skill document first.

## Skill Routing

- `config-driven-audio-minutes-pipeline`: Use when adapting the end-to-end audio-to-structured-document pipeline for meetings, interviews, consultations, training, audits, or similar voice-record tasks.
- `grounded-meeting-minutes-prompt-pack`: Use when the main need is prompt design for grounded summaries, decisions, action items, issues, Q&A, or structured minutes from an existing transcript.

For detailed implementation steps, validation checks, prompt rules, and examples, read the matching `skills/<slug>/SKILL.md` before making changes.

## Safety Rules

- Do not embed credentials, API keys, tokens, connection strings, or secrets in code or docs.
- Do not include private audio, transcripts, attendee data, customer data, or personal data in examples.
- Do not access systems, files, models, or services without explicit authorization.
- Do not run production jobs, send production messages, or modify production data without approval.
- Keep generated summaries grounded in source transcripts and mark uncertain content for human review.
