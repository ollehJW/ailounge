# Project Overview

This Claude harness helps adapt the original asset's reusable AI pattern to other work areas. Treat the source case as a reference implementation, then route to the relevant skill for detailed adaptation guidance.

Reference case: a meeting-minutes Agent that ingests meeting audio or recordings, performs speaker diarization and STT, corrects/transforms transcripts with an LLM, and generates a structured, reviewable minutes document.

# Runtime and Environment

Use these assumptions when the adapted implementation includes the referenced app stack:

- Backend: Python FastAPI. Recommended Python 3.10+ unless a target repo specifies otherwise.
- Frontend: React with Vite. Recommended Node.js 18+ unless package.json specifies otherwise.
- Package managers: `pip` for Python, `npm` for frontend packages.
- Key AI components: STT model such as Qwen ASR, speaker diarization such as pyannote, and an LLM provider such as Azure OpenAI.
- Model/API credentials must come from environment variables or a secrets manager, never from committed files.

Install commands when corresponding files exist:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

```bash
npm install
```

```bash
bash download_models.sh
```

# Common Commands

Backend API, when FastAPI source is present:

```bash
uvicorn backend.main:app --reload
```

Frontend dev server, when Vite/React source is present:

```bash
npm run dev
```

Frontend production build, when package scripts support it:

```bash
npm run build
```

# Repository Layout

- `CLAUDE.md`: compact session bootstrap and routing document.
- `skills/<slug>/SKILL.md`: detailed adaptation workflow, checks, validation guidance, and examples for each reusable pattern.
- `skills/<slug>/scripts/`: optional helper scripts for that skill.

Do not expand this root file into a full guide; put detailed procedures inside the relevant skill.

# Skill Routing

Open the matching `SKILL.md` before planning or changing implementation details:

- `skills/audio-transcript-postprocessing-pipeline/SKILL.md`: use when adapting audio upload/recording into diarized, normalized, corrected speaker transcripts.
- `skills/grounded-transcript-to-report-generator/SKILL.md`: use when adapting cleaned utterance JSON into grounded minutes, reports, decisions, risks, or action-item documents.

If a request spans both, start with transcript postprocessing, then route to grounded report generation.

# Safety Rules

- Do not embed credentials, API keys, tokens, passwords, or private certificates.
- Do not commit private meeting audio, transcripts, personal data, or confidential business content.
- Do not access systems, files, models, or APIs without explicit authorization.
- Do not run production jobs, send notifications, or publish generated documents without approval.
- Keep generated outputs grounded in provided inputs; mark uncertainty instead of inventing facts.
