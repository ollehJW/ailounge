---
name: config-driven-work-reporting-platform
description: Use this whenever the user needs to adapt or build a reusable work reporting workspace across teams, even if they only ask for weekly reports, task status collection, project updates, absence tracking, report history, FastAPI, SQLite, React, schema changes, workflow state rules, or HTML report generation. Trigger when they mention changing organizations, members, roles, work units, schedules, reporting periods, completion rules, validation rules, or output contracts.
---

## Purpose
This skill provides a configurable skeleton for a work reporting workspace that connects organizations, members, work units, schedules, reporting periods, entry status, and HTML reporting in one reusable data model, so the same pattern can be adapted for weekly, monthly, project, operations, or governance reporting across business areas.

## Required inputs
- Organization or team unit definitions.
- Member role system and role ordering rules.
- Work unit definitions and participant mapping.
- Reporting cadence, active period rules, and entry status rules.
- Absence, exclusion, completion, and history retention criteria.
- Runtime for the bundled executable skeleton: Python 3.10 or later. The script uses SQLite from the standard library and does not require credentials.

## Adaptation guide
Use `scripts/work_reporting_platform.py` as the executable SQLite skeleton and as the contract reference before implementing a FastAPI service or React screens around it. Decide the following before writing target-specific code: access boundaries per organization, role names and permissions, work unit hierarchy depth, member-to-work mapping source, event types, milestone date rules, allowed reporting periods, status transitions, HTML report grouping, retention period, and whether the UI exposes member-view, work-view, or both.

Checklist for adaptation decisions:
1. Map the target business terms to the common model: organization, member, work unit, milestone, event, report, member entry, and work entry.
2. Define role codes and sort order without embedding department-specific titles in code.
3. Decide which work units appear for each member and whether a configurable miscellaneous work unit is needed.
4. Define valid reporting periods, including whether only one in-progress report can exist per organization.
5. Specify how absence differs from work exclusion: absence applies to the member for the whole report period; exclusion applies to one work unit inside the entry.
6. Confirm status transitions: pending, progress, done, absent, in_progress, and completed, or adapt them consistently in API, UI, and reporting.
7. Choose input field labels for progress, risk or issue, and next plan while preserving structured list storage.
8. Decide report outputs: member report, work-unit report, history listing, file naming, and HTML styling.
9. Validate a sample configuration with `scripts/work_reporting_platform.py validate-config --config reporting-config.json` before implementing API routes or React state.

## Procedure
1. Prepare a configuration JSON and optional seed JSON for organizations, members, work units, assignments, milestones, and events.
2. Validate the configuration with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py validate-config --config reporting-config.json`.
3. Initialize the local SQLite database with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py init-db --config reporting-config.json --db workspace.db`.
4. Load seed data with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py import-seed --db workspace.db --seed seed.json`.
5. Open a reporting period with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py open-report --db workspace.db --org-id org-1 --start-date 2026-08-03 --end-date 2026-08-07`.
6. Submit member work content with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py submit-entry --db workspace.db --report-id <report_id> --member-id <member_id> --work-id <work_id> --entry-file entry.json`.
7. Record exceptions with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py set-absence --db workspace.db --report-id <report_id> --member-id <member_id> --absent true` or `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py set-exclusion --db workspace.db --report-id <report_id> --member-id <member_id> --work-id <work_id> --excluded true`.
8. Check readiness with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py check-report --db workspace.db --report-id <report_id>`.
9. Complete the report with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py complete-report --db workspace.db --report-id <report_id>`.
10. Generate outputs with `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py render-member-report --db workspace.db --report-id <report_id> --member-id <member_id> --out member.html` and `python skills/config-driven-work-reporting-platform/scripts/work_reporting_platform.py render-work-report --db workspace.db --report-id <report_id> --work-id <work_id> --out work.html`. Validate the result by confirming no pending required entries remain, excluded work is hidden from member reports, absent members are marked at member level, and the generated HTML groups the same source data correctly by both member and work unit.

## Failure and exception handling
- Invalid period: reject date ranges where the end date is before the start date or the period has no weekday.
- Duplicate active report: complete or delete the existing in-progress report before opening another for the same organization.
- Missing assignment: reject entries when the member is not mapped to the selected work unit.
- Empty content: keep the work entry pending unless it is explicitly excluded.
- Partial completion: keep the member entry in progress until all assigned work entries are done or excluded.
- Absence conflict: absence overrides member entry status but should not delete already stored work content unless the target policy requires purging.
- Report rendering error: verify the report, member, work unit, and output directory exist, then rerun the render command.

## Security and privacy precautions
- Do not embed passwords, tokens, internal URLs, or real employee identifiers in configuration, seed files, generated HTML, or scripts.
- Use environment variables or the target platform secret store for credentials when wrapping the skeleton with FastAPI or another service.
- Treat report content as potentially sensitive business information; restrict database, API, and HTML output access by organization and role.
- Minimize personally identifiable data to the fields required for reporting, such as display name, role, and assignment.
- Apply retention and deletion rules to completed report history and generated HTML exports.
- Escape HTML output and validate structured input before storage to prevent script injection in report previews.
