# Project Overview

This Claude harness helps adapt the reusable pattern from the original AI asset to other work areas. Use this file as a compact session bootstrap; detailed adaptation workflows live in each `skills/*/SKILL.md`.

Reference case: a PaddleOCR-based PDF text extraction PoC that renders scanned or image-based PDFs with PyMuPDF, runs OCR, and saves searchable text files. Treat it as a reference pattern, not a fixed target implementation.

## Runtime and Environment

- Primary runtime: Python. Recommended assumption: Python 3.9+ unless a target repo specifies otherwise.
- Package manager: `pip` with `requirements.txt` when present.
- Important libraries inferred from the reference asset: `paddleocr`, `paddlepaddle` or `paddlepaddle-gpu`, `PyMuPDF`/`fitz`, and YAML configuration support such as `PyYAML`.
- GPU use requires a PaddlePaddle build matching the host CUDA/cuDNN environment; otherwise prefer CPU mode for portability.
- No Node.js, browser automation, or Playwright runtime is indicated for the selected OCR harness skills unless added by a target repo.

Install baseline Python dependencies when a requirements file is present:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Common Commands

Inspect available skills:

```bash
find skills -maxdepth 2 -type f | sort
```

Open a selected skill guide:

```bash
sed -n '1,220p' skills/config-driven-pdf-ocr-pipeline/SKILL.md
sed -n '1,220p' skills/pdf-ocr-runtime-configuration-guide/SKILL.md
```

Run a Python OCR entrypoint when present in an adapted repo:

```bash
python main.py --config config.example.yaml
```

Check Python dependencies:

```bash
python --version
pip freeze
```

## Repository Layout

- `CLAUDE.md`: session bootstrap, routing, runtime assumptions, and safety rules.
- `skills/<slug>/SKILL.md`: detailed adaptation guidance for a reusable pattern.
- `skills/<slug>/scripts/`: optional helper scripts or scaffolds used by the skill.

Do not expand this root file into a long guide. Put checklists, validation steps, examples, and implementation details inside the relevant skill.

## Skill Routing

Open the relevant `SKILL.md` before designing or editing an adaptation.

- `config-driven-pdf-ocr-pipeline`: use when adapting a YAML/config-driven batch OCR pipeline for PDF folders or file lists.
- `pdf-ocr-runtime-configuration-guide`: use when choosing CPU/GPU runtime, PaddlePaddle setup, OCR language, DPI, and tuning options.

## Safety Rules

- Do not embed credentials, API keys, tokens, private keys, or secrets in code, configs, prompts, logs, or docs.
- Do not include private, personal, customer, supplier, or confidential document data in examples or tests.
- Do not access systems, repositories, network paths, or documents without explicit authorization.
- Do not run production jobs, destructive commands, bulk processing, or external network operations without approval.
- Prefer local, sanitized samples and placeholder paths for demonstrations.
