---
name: grounded-structured-report-generator
description: Use this whenever the user needs to generate or adapt a grounded Markdown report from timestamped or speaker-labeled transcript items, even if they only ask for meeting notes, interview summaries, consultation records, incident writeups, or action-item extraction. Trigger when they mention transcript JSON, speaker/time/content rows, prompt templates, special instructions, section contracts, LLM report generation, Markdown outputs, or validation of decisions, issues, and action items.
---

## Purpose
This skill adapts and runs a reusable workflow that normalizes corrected utterance records into a grounded transcript, combines them with a document prompt template and special instructions, and generates a structured Markdown report focused on decisions, issues, and action items for any business process that produces speaker/time/content evidence.

## Required inputs
- Corrected utterance list JSON: either a JSON array or an object containing `sentences`, with each item carrying `content` plus speaker and time information where available.
- Document generation prompt template: a text file with `{transcript_text}` and `{instruction_block}` placeholders; it may also include `{section_block}`.
- User special instructions: optional emphasis, exclusions, audience, tone, or domain-specific reporting rules.
- Output document section definition: JSON list or `{ "sections": [...] }` describing required Markdown sections.
- LLM model and API settings: set in environment variables or an `.env` file (`OPENAI_API_KEY`, `OPENAI_MODEL`, and endpoint/version values required by the selected provider).
- Runtime dependency for the bundled skeleton: Python 3.10+ and the `openai` package when making an LLM call; dry-run and validation modes do not call the LLM.

## Adaptation guide
Before writing or changing code, make these design decisions once for the target workflow:
1. Define the evidence contract: choose the earliest trusted input stage, confirm whether the utterance JSON is a list or `sentences` object, and map source fields into `index`, `speaker`, `time`, and `content`.
2. Define access and configuration: decide which LLM provider mode to use, which model name is approved, where `.env` will live, and which settings must remain environment variables rather than code constants.
3. Define the document contract: create the section JSON for the target business document, including mandatory sections such as summary, key discussion, decisions, risks, follow-up tasks, or domain equivalents.
4. Define prompt rules: keep the transcript as the sole evidence source, require uncertain facts to be marked as needing confirmation, and instruct the model not to invent owners, deadlines, or decisions.
5. Define execution behavior: decide whether the workflow should run as a local batch script, an API worker step, or a human-review preparation step; keep report generation after transcript correction and speaker review when those stages exist.
6. Define validation expectations: identify required headings, whether action items must be tables, whether every task needs owner/work/due-date fields, and what should block publication versus create a warning.
7. Use `skills/grounded-structured-report-generator/scripts/generate_structured_report.py` as the adaptation skeleton when the input is already a corrected utterance list and the output should be a Markdown report.

## Procedure
1. Prepare the transcript JSON, prompt template, section definition JSON, and `.env` file in the working project.
2. Run input and template validation without calling the LLM:
   `python skills/grounded-structured-report-generator/scripts/generate_structured_report.py --input-json data/refined_sentences.json --prompt-template config/report_prompt.txt --sections-json config/report_sections.json --output-md out/report.md --validate-only`
3. Inspect the validation messages and fix empty content, missing prompt placeholders, or incorrect section definitions before generation.
4. Optionally render the final prompt for review:
   `python skills/grounded-structured-report-generator/scripts/generate_structured_report.py --input-json data/refined_sentences.json --prompt-template config/report_prompt.txt --sections-json config/report_sections.json --output-md out/report.md --special-instruction "Emphasize confirmed decisions and unresolved risks." --dry-run --prompt-output out/report_prompt.txt`
5. Execute the generation call:
   `python skills/grounded-structured-report-generator/scripts/generate_structured_report.py --input-json data/refined_sentences.json --prompt-template config/report_prompt.txt --sections-json config/report_sections.json --output-md out/report.md --special-instruction "Emphasize confirmed decisions and unresolved risks."`
6. Validate the result by reviewing the generated Markdown and the companion validation JSON for missing required headings, empty output, code-fence wrapping, or weak action-item structure.

## Failure and exception handling
- Invalid input JSON: stop, repair the JSON, and confirm whether records are stored directly as a list or under `sentences`.
- Empty or unusable utterances: block generation until the upstream transcript stage provides non-empty `content` values.
- Missing speaker or time fields: continue with defaults only if the target document does not require speaker/time traceability; otherwise return the file to the mapping stage.
- Prompt placeholder errors: update the template to use only `{transcript_text}`, `{instruction_block}`, and `{section_block}`, or escape unrelated braces.
- LLM configuration errors: verify environment variables and provider mode before retrying; never paste credentials into the script or prompt file.
- Over-generated decisions or action items: tighten prompt rules so only explicitly evidenced decisions and owner/task/due-date combinations become action items.
- Missing required Markdown sections: regenerate with a stricter section definition or manually route the draft for human correction before sharing.

## Security and privacy precautions
- Store API keys only in environment variables or a local `.env` file excluded from version control.
- Treat transcripts and generated reports as potentially sensitive because they may contain names, commercial terms, personnel details, customer data, or operational decisions.
- Do not include raw transcripts in logs beyond local validation counts and file paths.
- Apply least-privilege access to input, output, prompt, and validation files; delete temporary prompt files when retention is not required.
- If personal or regulated data is present, confirm that the selected LLM endpoint, retention policy, and storage location are approved for that data class.
