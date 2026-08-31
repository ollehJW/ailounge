# Project Overview

This harness helps adapt the original asset's reusable automation pattern to other work areas. Treat it as a compact routing document: detailed adaptation workflows, checklists, validation steps, and examples live in `skills/*/SKILL.md`.

Reference case: a Playwright-based browser agent logs into a purchasing portal, reads a CSV/XLSX list of order dates and request numbers, searches matching quote/order records, downloads attachments, and reports collection results.

# Runtime and Environment

- Package manager: npm.
- Recommended Node.js: 18+ for modern ESM scripts and Playwright usage.
- Main runtime/library: Playwright for browser automation.
- Frontend assets may include plain web files under `web/`; adapt per skill if a React UI is introduced.
- Python/FastAPI is part of the reference architecture pattern, but no Python runtime is required for this harness unless a skill-specific implementation adds it. If added, use Python 3.10+ as a recommended baseline.
- Browser automation requires Playwright browser binaries.

Install:

```bash
npm install
npx playwright install
```

# Common Commands

Install dependencies:

```bash
npm install
```

Install Playwright browsers:

```bash
npx playwright install
```

Open a skill guide:

```bash
cat skills/config-driven-browser-document-collector/SKILL.md
cat skills/input-list-driven-automation-workflow/SKILL.md
```

Run reference scripts only if present and approved for the target environment:

```bash
node scripts/login-autoway.mjs
node scripts/manual-autoway-web.mjs
```

# Repository Layout

- `CLAUDE.md`: session bootstrap and routing rules.
- `skills/<slug>/SKILL.md`: detailed adaptation guidance for each reusable pattern.
- `skills/<slug>/scripts/`: optional helper scripts or skeleton code for that skill.
- `scripts/`, `web/`: reference implementation assets when present; adapt through the relevant skill, not by copying blindly.

# Skill Routing

Open the relevant `SKILL.md` before designing or changing implementation details.

- `config-driven-browser-document-collector`: use when adapting portal login, search, matching, and attachment download automation to another business portal.
- `input-list-driven-automation-workflow`: use when building CSV/XLSX upload, required-column validation, row-by-row processing, status tracking, and result export.

# Safety Rules

- Do not embed credentials, tokens, cookies, secrets, or private data in code, docs, logs, or examples.
- Do not commit real portal URLs, account identifiers, internal endpoints, or downloaded business documents unless explicitly approved and sanitized.
- Do not attempt unauthorized access, credential bypass, scraping outside approved scope, or hidden session reuse.
- Do not run against production systems without explicit user approval and a safe execution plan.
- Prefer configuration placeholders and local test fixtures for examples.
