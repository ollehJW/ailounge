---
name: grounded-transcript-to-report-generator
description: Use this whenever the user needs to turn a speaker-attributed transcript into a grounded Markdown report, minutes, call summary, review note, audit memo, or action-item document. Trigger proactively when they mention transcript JSON, speaker/time/content fields, report sections, output format rules, LLM prompt adaptation, reference material, human review, validation, or finalization of generated documents.
---

## Purpose
This skill provides a reusable skeleton for converting refined utterance data into a grounded Markdown document that emphasizes decisions, discussion points, action items, risks, and other reviewable sections; the same pattern applies across business areas wherever source statements must become an auditable report.

## Required inputs
- Refined utterance JSON as either a list or an object containing a `sentences` list. Each utterance must map to speaker, time, and content; index is recommended.
- Document writing instructions from the requester, including emphasis, tone, exclusions, and any domain-specific terminology.
- Target document contract: document type, Markdown section titles, inclusion/exclusion rules, action-item rules, and uncertainty wording.
- LLM API connection settings supplied through environment variables or an `.env` file: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, optional `OPENAI_API_VERSION`, and optional `OPENAI_MODEL`.
- Optional reference text or reference files used only as supporting context, not as independent evidence for facts absent from the transcript.
- Runtime dependency for `scripts/transcript_to_report.py`: Python 3.10+ and the `openai` package for live LLM generation. `pdftotext` is needed only for PDF reference extraction, and LibreOffice or `soffice` only for legacy PPT extraction.

## Adaptation guide
Use `scripts/transcript_to_report.py` as the config-driven skeleton for transcript loading, input normalization, prompt construction, optional reference extraction, LLM execution, Markdown writing, and output validation. Before changing code, decide the reusable contract for the target workflow: which source fields map to canonical utterance fields, what evidence can be used, which sections are mandatory, how action items must prove owner/task/due date, whether low-confidence items should be marked with the configured uncertainty phrase, and what human approval step makes the document final.

Checklist before implementation:
1. Inspect representative transcript JSON and define `input_mapping` in the config if fields differ from `index`, `speaker`, `time`, and `content`.
2. Define the target `document_type`, `sections`, `inclusion_criteria`, `exclusion_criteria`, `rules`, `action_item_policy`, and `uncertainty_phrase` in a config JSON file.
3. Decide whether reference materials are allowed, and document that they may guide terminology or context but must not introduce unsupported facts.
4. Choose execution behavior: `--validate-only` for input checks, `--dry-run --print-prompt` for prompt review, `--strict-headings` when missing sections should fail the run, and `--max-prompt-chars` for prompt-size control.
5. Define the human-in-the-loop review point: who checks speaker names, utterance edits, generated decisions, action items, and sensitive wording before final distribution.
6. Set output retention and naming rules for transcript JSON, extracted reference text, generated Markdown, and validation JSON.

## Procedure
1. Prepare a config JSON for the target document contract and confirm the transcript file is accessible locally.
2. Configure LLM access in the shell or `.env` file without embedding credentials in the transcript, config, or script.
3. Run input validation before generation:
   `python skills/grounded-transcript-to-report-generator/scripts/transcript_to_report.py --transcript input/transcript.json --config config/report_config.json --output out/report.md --validate-only`
4. Review the assembled prompt without calling the LLM:
   `python skills/grounded-transcript-to-report-generator/scripts/transcript_to_report.py --transcript input/transcript.json --config config/report_config.json --output out/report.md --dry-run --print-prompt --reference-text input/context.txt`
5. Generate the Markdown report:
   `python skills/grounded-transcript-to-report-generator/scripts/transcript_to_report.py --transcript input/transcript.json --config config/report_config.json --output out/report.md --special-instruction instructions.txt --reference-file input/reference.pdf --validation-output out/validation.json --strict-headings`
6. Validate the result by checking the script exit status, the validation JSON warnings/errors, required Markdown headings, evidence-grounding language, action-item owner/task/due-date completeness, and any items marked with the configured uncertainty phrase.

## Failure and exception handling
- Malformed transcript JSON or missing utterance content: stop the run, fix the upstream transcript export or add `input_mapping`, then rerun `--validate-only`.
- Empty normalized transcript: inspect whether source content fields are blank, filtered out, or incorrectly mapped.
- Unsupported or unreadable reference file: remove the file, convert it to text, or install the required extractor; do not block report generation if reference context is optional.
- Missing LLM settings: set the required environment variables or use `--dry-run` to inspect the prompt without generation.
- Prompt too large: reduce reference text, split the transcript by agenda/time period, or increase `--max-prompt-chars` only if the target model supports it.
- Missing required Markdown sections: rerun with clearer config sections and `--strict-headings`, then review whether the source transcript actually contains evidence for those sections.
- Unsupported decisions or action items in the output: mark them for human correction, revise the grounding rules, and regenerate from the same transcript rather than editing the prompt to invent details.

## Security and privacy precautions
- Keep API keys and endpoints in environment variables or `.env`; never commit credentials or place them in generated reports.
- Treat transcripts, speaker names, reference files, and generated reports as sensitive business records; store them only in approved locations.
- Limit reference files to materials authorized for the report audience, and remember they are sent to the LLM unless using `--dry-run` or `--validate-only`.
- Apply least-privilege access to output folders and validation artifacts because they can reveal decisions, owners, timelines, and unresolved risks.
- Follow local retention rules for temporary transcripts, extracted reference text, prompts, and drafts after the human reviewer finalizes the document.
