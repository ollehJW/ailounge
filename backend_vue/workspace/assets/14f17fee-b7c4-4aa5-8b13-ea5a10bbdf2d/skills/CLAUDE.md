# Project Overview

This harness helps Claude adapt the original asset's reusable AI pattern to other work areas. Treat it as a compact routing layer: use this file to choose the right skill, then open the relevant `skills/<slug>/SKILL.md` for the actual adaptation guidance.

Reference case: a meeting-minutes agent that accepts meeting audio or recordings, performs speaker diarization and STT, applies LLM-based correction and structuring, and produces reviewable Markdown meeting minutes with decisions, discussion points, and action items.

# Runtime and Environment

This repository is primarily a Claude skill harness. Detailed implementation assumptions live in each skill.

Recommended assumptions when adapting the reference implementation:
- Python: 3.10+ recommended for FastAPI, STT, diarization, and LLM orchestration components.
- Node.js: 18+ recommended for React frontend work.
- Package managers: `pip` for Python dependencies, `npm` for frontend dependencies.
- Backend stack referenced by the asset: FastAPI, STT model integration, speaker diarization, Azure OpenAI-compatible chat API.
- Frontend stack referenced by the asset: React.
- Model/runtime setup may require local model downloads and GPU/audio dependencies depending on the target environment.

Install only the dependencies that exist in the target repo:
```bash
python -m pip install -r requirements.txt
npm install
```

If model setup scripts are present:
```bash
bash download_models.sh
```

# Common Commands

Inspect available skills:
```bash
find skills -maxdepth 2 -name SKILL.md -print
```

Open the transcript pipeline skill:
```bash
cat skills/audio-transcript-postprocessing-pipeline/SKILL.md
```

Open the structured report skill:
```bash
cat skills/grounded-structured-report-generator/SKILL.md
```

Check common runtime versions:
```bash
python --version
node --version
npm --version
```

Install Python dependencies when present:
```bash
python -m pip install -r requirements.txt
```

Install frontend dependencies when present:
```bash
npm install
```

# Repository Layout

- `CLAUDE.md`: compact session bootstrap and skill routing document.
- `skills/<slug>/SKILL.md`: detailed adaptation guidance, checklists, validation steps, and examples.
- `skills/<slug>/scripts/`: optional helper scripts for a specific skill.

Do not expand this root file into a full guide; keep detailed work inside the selected skill.

# Skill Routing

Open the relevant `SKILL.md` before designing or changing an adaptation.

- `audio-transcript-postprocessing-pipeline`: Use when adapting audio upload, speaker segmentation, STT, transcript correction, or speaker matching pipelines.
- `grounded-structured-report-generator`: Use when turning corrected utterance lists into grounded Markdown reports, meeting minutes, summaries, decisions, or action-item documents.

# Safety Rules

- Do not embed credentials, API keys, tokens, cookies, or private certificates in code or docs.
- Do not include private meeting audio, transcripts, personal data, or customer data in examples.
- Do not access systems, files, models, or APIs without explicit authorization.
- Do not run production jobs, migrations, downloads, or destructive commands without approval.
- Keep generated outputs grounded in provided source data; flag uncertainty instead of inventing facts.
