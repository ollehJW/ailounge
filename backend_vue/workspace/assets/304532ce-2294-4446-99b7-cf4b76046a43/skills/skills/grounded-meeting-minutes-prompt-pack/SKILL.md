---
name: grounded-meeting-minutes-prompt-pack
description: Use this whenever the user needs grounded prompts or review checks for turning STT transcripts into meeting minutes or business records, even if they only ask for a summary. Trigger on transcripts, speaker/time utterance lists, meeting recordings already transcribed, action items, decisions, issues, Q&A, minutes templates, or concerns about hallucinations in meeting notes.
---

## Purpose
This skill helps adapt a grounded prompt pack that converts speaker/time-stamped STT text into structured business minutes while preventing unsupported additions; the same pattern applies to meetings, interviews, training sessions, consultations, audits, and project reviews.

## Required inputs
- Transcript text with speaker labels and timestamps, preferably one utterance per line.
- Purpose of the meeting or business record.
- Sections that must appear in the final document.
- Organization-specific document tone and criteria for content to exclude.
- Criteria for deciding whether an item is a real action item.
- Runtime for bundled helpers: Python 3.9+ with only the standard library.

## Adaptation guide
Decide the document contract before writing or running prompts. Define which metadata belongs in the prompt, which transcript fields are authoritative, how uncertain speaker labels are shown, which topics are important enough to preserve, and which utterances should be filtered as greetings, repetition, side talk, or low-confidence STT noise. Keep correction, speaker attribution, and final document generation as separate responsibilities; the final minutes prompt should treat the transcript as evidence, not as inspiration.

Checklist:
1. Normalize the input format to lines like `[index] Speaker (time): content`; if names are uncertain, keep a neutral speaker label rather than guessing.
2. Choose required sections such as summary, agenda, discussion, decisions, action items, issues/risks, and decision-related Q&A.
3. Write inclusion rules: decisions, deferred decisions, owner/deadline commitments, risks, disagreements, and context needed by absent stakeholders.
4. Write exclusion rules: greetings, simple acknowledgements, repeated wording, irrelevant small talk, and unintelligible STT fragments.
5. Define action item rules strictly: include only tasks agreed in the transcript with an owner and task; use `confirmation needed` for missing deadlines, and do not promote vague suggestions into commitments.
6. Define uncertainty handling: mark unsupported or ambiguous claims as `confirmation needed`; do not resolve ambiguity using outside knowledge.
7. Create a JSON config for the helper script with `purpose`, `required_sections`, `tone`, `exclude_criteria`, `action_item_rules`, and optional `output_language`.
8. Use `scripts/build-grounded-minutes-prompt.py` after these decisions to generate the reusable prompt text from the transcript and config.

## Procedure
1. Prepare the transcript file and remove content that should not be processed under policy or retention rules.
2. Create or update the config file for this run.
3. Run the prompt builder:
   `python skills/grounded-meeting-minutes-prompt-pack/scripts/build-grounded-minutes-prompt.py --transcript transcript.txt --config minutes-config.json --output prompt.txt`
4. Send `prompt.txt` to the approved LLM environment and save only the Markdown minutes body as `draft-minutes.md`.
5. Run the grounding checker:
   `python skills/grounded-meeting-minutes-prompt-pack/scripts/check-minutes-grounding.py --transcript transcript.txt --minutes draft-minutes.md --config minutes-config.json --report-output validation.json`
6. Validate the result by reviewing `validation.json`, checking that all required sections exist, action items have owner/task/deadline status, and any flagged unsupported numbers, dates, or low-grounding terms are removed or marked `confirmation needed`.

## Failure and exception handling
- Poor STT quality: do not ask the LLM to infer missing speech; mark unclear content as `confirmation needed` or return the transcript for correction.
- Unknown or mismatched speakers: keep generic speaker labels unless a human-approved mapping exists.
- Over-generated action items: remove items without an explicit owner and concrete task, or move them to discussion/issue notes.
- Hallucinated decisions, dates, quantities, or attendees: compare against the transcript and delete anything not evidenced.
- Transcript exceeds model context: split by agenda or time window, summarize each chunk with the same grounding rules, then merge only repeated or explicitly connected decisions.
- Validation script warns on low grounding: manually inspect flagged terms; accept only template headings or organization-standard labels that are intentionally absent from the transcript.

## Security and privacy precautions
- Do not embed API keys, credentials, internal URLs, or secrets in prompts, configs, scripts, or examples.
- Use only approved LLM endpoints for transcripts containing personal, customer, legal, financial, HR, or regulated data.
- Redact sensitive personal data unless it is required for ownership, decisions, or compliance evidence.
- Treat reference materials as context for correcting terminology only; never let them introduce facts that were not stated in the transcript.
- Store intermediate transcripts, prompts, validation reports, and draft minutes in access-controlled temporary workspaces and delete them according to retention policy.
