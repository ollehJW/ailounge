---
name: input-list-driven-automation-workflow
description: Use this whenever the user needs to build or adapt an automation that starts from a CSV/XLSX target list and processes each row as a business unit. Trigger aggressively for uploaded target lists, required column validation, row-by-row portal lookup, bulk document collection, repeated status tracking, result CSV generation, or success/failure verification workflows, even if the user only asks for a small script.
---

## Purpose
This skill standardizes automations that ingest a CSV/XLSX list, validate required columns, process each row independently, track pending/running/success/failure status, and produce auditable result files; the pattern is reusable across business areas because only the input mapping, row action, and success criteria change.

## Required inputs
- CSV/XLSX input file format and expected sheet behavior, including whether the first row is the header.
- Required column list and normalization rules such as trimming, date formatting, identifier cleanup, duplicate handling, and empty-row filtering.
- Row-level processing function or portal action: the operation to perform for one row after fields are mapped.
- Success/failure criteria and result output columns, including what evidence proves completion.
- Runtime note for bundled scripts: use Node.js with ES modules; install `xlsx` if XLSX/XLS input support is needed.

## Adaptation guide
Decide the reusable contract before writing portal- or workflow-specific code. Define the canonical fields the automation will use internally, then map each input column to those fields; choose which field becomes the business identifier used for logs, folders, and result rows. Decide how access will be obtained without embedding credentials, how the row action will locate the target record, what should happen when the record is missing or ambiguous, which attachments or outputs count as valid, and where files should be stored.

Checklist:
1. Name the workflow unit, for example claim, request, order, employee, supplier, ticket, or document case.
2. List required input columns and aliases, then define normalization for dates, IDs, text casing, and blank values.
3. Choose the unique row key; if no single key is unique, define a composite key and duplicate policy.
4. Specify the row action as a deterministic function: input fields in, expected artifact/status out.
5. Define evidence of success, such as a downloaded non-empty file, a matched record count of one, a generated confirmation number, or a portal success message.
6. Define output structure: per-identifier folder naming, result CSV columns, summary JSON, and retry list requirements.
7. Use `scripts/validate-input-list.mjs` before adapting the input mapping to confirm the source file can be normalized reliably.
8. Use `scripts/list-workflow-runner.mjs` as the config-driven skeleton when you need a safe local runner for parsing, status tracking, result CSV generation, and optional delegation to a separate row processor.

## Procedure
1. Prepare the input file and remove rows that should not be processed in the current run.
2. Create a workflow config JSON for `scripts/list-workflow-runner.mjs` with `requiredColumns`, `idField`, optional `dateFields`, optional `resultColumns`, and either dry-run mode or a `processorCommand` for the row-level implementation.
3. Validate the file before execution:
   `node scripts/validate-input-list.mjs --input ./targets.xlsx --required-columns "requestDate,requestId" --date-columns "requestDate" --id-column "requestId" --output-json ./artifacts/input-validation.json`
4. Configure environment variables required by the adapted row processor, such as portal base URL, credential references, output root, or browser mode; do not put secrets in the config file.
5. Run the skeleton locally first without external side effects:
   `node scripts/list-workflow-runner.mjs --input ./targets.xlsx --config ./workflow-config.json --output-dir ./artifacts/run-001 --dry-run`
6. Run the adapted collection or row action after validation passes:
   `node scripts/list-workflow-runner.mjs --input ./targets.xlsx --config ./workflow-config.json --output-dir ./artifacts/run-001 --allow-command`
7. Validate the result by comparing total input rows with `summary.json`, checking each row status in `results.csv`, confirming expected files exist under per-identifier folders, and creating a retry list from failed rows only.

## Failure and exception handling
- Missing required columns: stop before processing and return the missing column names; do not infer columns silently.
- Invalid dates or identifiers: mark affected rows as failed during validation or normalize them explicitly according to the agreed rule.
- Duplicate identifiers: either fail validation or convert the row key to a composite key before output folders are created.
- Row action timeout: mark only that row as failed, capture the message, and continue unless the failure indicates global access loss.
- No matching record: record a failed status with a clear reason and include the search key used.
- Multiple matching records: fail the row unless the workflow defines a deterministic tie-breaker.
- Missing, empty, or wrong attachment/output: treat the row as failed even if navigation or lookup succeeded.
- Interrupted run: keep partial `status-log.jsonl`, `results.csv`, and per-identifier folders; resume from rows without a success status.

## Security and privacy precautions
- Never hard-code usernames, passwords, tokens, or internal URLs in scripts or workflow config; use environment variables, a vault, or an approved credential prompt.
- Store downloaded files and result CSVs only in approved locations because row identifiers and attachments may contain confidential data.
- Limit logs to row keys, statuses, and short error messages; avoid writing full page contents, credentials, or unnecessary personal data.
- Apply retention rules to input files, browser session state, screenshots, downloads, and archives after the business verification period.
- Restrict access to output folders and retry lists to the process owner and authorized reviewers.
