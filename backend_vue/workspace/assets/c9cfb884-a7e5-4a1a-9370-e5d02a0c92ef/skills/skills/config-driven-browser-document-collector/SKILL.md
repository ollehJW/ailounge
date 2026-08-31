---
name: config-driven-browser-document-collector
description: Use this whenever the user needs to adapt a portal/list-driven document collection workflow, even if they do not explicitly ask for this skill. Trigger when they mention portal attachments, CSV/Excel target lists, repeated downloads, identifier-based search, browser automation, session reuse, or download result validation.
---

## Purpose
This skill helps build a reusable, configuration-driven browser automation workflow that reads a target list, searches a business portal row by row, downloads matching documents, stores them by business identifier, and produces verifiable collection results across purchasing, quality, finance, compliance, or other portal-based processes.

## Required inputs
- Target portal URL, authentication method, and whether credentials come from environment variables, interactive entry, SSO, or a pre-saved browser session.
- Input file format and required columns, including the business identifier column and any date or search-condition columns.
- Browser selectors and behavior for the list page, detail page, search fields, search trigger, no-result indicator, and attachment/download controls.
- Download filename filter rules, output folder naming rule, overwrite/collision rule, and expected result report format.
- Runtime dependencies for the bundled helpers: Node.js 18+, Playwright for browser execution, and the `xlsx` package if Excel input is used.

## Adaptation guide
Separate portal-specific decisions from the reusable execution loop. Keep the script generic and move variable behavior into a JSON config: start URL, login actions, per-row search actions, optional result checks, attachment click targets, filename filters, and output naming templates.

Before writing portal-specific code, complete this checklist:
1. Define the input contract: required columns, aliases if source files vary, date normalization rules, and the unique identifier used for output folders.
2. Map each input column to a portal action: which value fills which field, which value defines a date range, and which value is used to match a row or detail page.
3. Decide authentication handling: direct login steps, manual login with saved session, SSO handoff, OTP/manual pause, or a separate pre-login script. Do not embed credentials in config or code.
4. Capture robust selectors using accessible labels, stable IDs, roles, or text near controls. Avoid brittle absolute XPaths unless no alternative exists.
5. Define result semantics: what counts as no result, wrong match, no attachment, successful download, filtered-out download, and retryable portal error.
6. Define attachment rules: which buttons or links initiate downloads, which filenames are allowed, whether non-matching files are discarded, and how duplicate filenames are renamed.
7. Generate a starter config with `scripts/collect-documents.mjs --print-config-template`, then replace placeholders with the portal-specific selectors and templates.
8. Use `scripts/validate-input-list.mjs` before adapting the workflow input mapping to confirm the source file columns, date formats, empty identifiers, and duplicate identifiers.

## Procedure
1. Prepare the target CSV/XLSX file and confirm it contains the agreed required columns.
2. Create or update the config JSON:
   `node skills/config-driven-browser-document-collector/scripts/collect-documents.mjs --print-config-template > collector.config.json`
3. Validate the input file before browser execution:
   `node skills/config-driven-browser-document-collector/scripts/validate-input-list.mjs --input ./targets.csv --columns "businessId,requestDate" --date-columns "requestDate" --id-column businessId`
4. Set credentials or session-related values through environment variables referenced by the config, for example `PORTAL_USER` and `PORTAL_PASSWORD`.
5. Run a mapping-only rehearsal if needed:
   `node skills/config-driven-browser-document-collector/scripts/collect-documents.mjs --config ./collector.config.json --input ./targets.csv --out-dir ./downloads --dry-run`
6. Execute the collection:
   `node skills/config-driven-browser-document-collector/scripts/collect-documents.mjs --config ./collector.config.json --input ./targets.csv --out-dir ./downloads --headless true`
7. Validate the result by comparing `result.csv` and `result.json` in the output directory against the input row count, then inspect per-identifier folders for non-empty files whose names match the configured filters.

## Failure and exception handling
- Login or session failure: stop the run, capture a screenshot if configured by the caller, refresh the session, and rerun only after confirming access is valid.
- Input validation failure: fix missing columns, blank identifiers, invalid dates, or duplicate identifiers before browser execution.
- Selector not found: re-open the portal, inspect whether the page is in a different frame, popup, language, or role state, then update only the config selectors if possible.
- No search result: mark the row as failed or skipped according to business rules; do not create an empty success folder.
- Multiple ambiguous matches: require an additional match rule before downloading to avoid collecting the wrong document.
- Download timeout or zero-byte file: retry the row if the portal is unstable; otherwise record the row as failed with the filename or selector that failed.
- Filename filter mismatch: keep the audit record and discard or quarantine non-matching files according to the configured retention rule.
- User stop request or partial run: preserve `result.json` and rerun only failed rows or rows without successful output folders.

## Security and privacy precautions
- Never store passwords, OTP values, API tokens, or session cookies in the skill files, repository, logs, or config templates.
- Pass credentials through environment variables or an approved secret manager, and mask any user-facing logs that could include secrets.
- Treat input files, downloaded documents, screenshots, storage-state files, and result CSVs as sensitive because they may contain personal, supplier, financial, or contractual data.
- Restrict output directories to approved local or shared locations with access control, and apply the business retention schedule after validation.
- Avoid broad scraping: collect only rows present in the approved input list and only attachment types allowed by the configured filename filters.
