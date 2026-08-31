---
name: config-driven-audio-minutes-pipeline
description: Use this whenever the user needs to build or adapt an audio-to-structured-record pipeline, even if they only mention meeting notes, interview summaries, call records, training transcripts, speaker diarization, STT correction, action item extraction, or human review of generated minutes.
---

## Purpose
This skill turns recorded audio into a reviewed structured document by chaining diarization, speech-to-text, context-aware correction, speaker matching, document generation, and final human approval; the same pattern works for meetings, interviews, consultations, lessons, field reports, and other voice-based business records.

## Required inputs
- Audio or recording file to process, with expected language, duration range, and file format constraints.
- Document-type metadata and speaker candidate list, such as title, purpose, date, participant names, roles, or customer and interviewer labels.
- STT model, diarization model, and LLM connection settings; the bundled scripts do not include model runtimes or credentials.
- Final document sections and review criteria, including what must be treated as decisions, actions, risks, questions, or unresolved items.
- Optional reference material or glossary text used only to improve STT correction and terminology consistency.
- Local runtime for bundled helpers: Python 3.10 or later, standard library only. Use `scripts/validate_pipeline_config.py` to check configuration and `scripts/audio_minutes_pipeline.py` as the reusable skeleton.

## Adaptation guide
Decide the workflow contract before writing portal, API, or model-specific code. Define how access is granted to audio and reference files, which metadata fields are mandatory, how speaker candidates are represented, which model or service owns each stage, and where intermediate artifacts are stored. Keep the LLM responsibilities separated: one prompt or adapter for conservative STT correction, one for speaker-to-person matching with confidence and evidence, and one for final document writing from grounded transcript evidence. For attachment or reference rules, specify allowed file types, text extraction limits, retention, and whether references can influence only terminology correction or also final document context. For output rules, define the required Markdown or JSON sections, editability, final approval status, and naming convention for draft versus confirmed records.

Decision checklist:
1. Choose the record type and target sections, then remove sections that do not fit the business process.
2. Map required metadata to config keys: audio file, title or case name, purpose, date or time window, speaker candidates, and optional instructions.
3. Set diarization thresholds for merging short gaps, dropping short segments, and splitting long speech chunks.
4. Specify STT output schema as a sentence list containing index, speaker or speaker_id, content, and time or start and end.
5. Define correction rules so the model fixes only clear transcription errors and does not rewrite meaning.
6. Define speaker matching rules so low-confidence identities remain unresolved instead of being forced.
7. Define the human review screen or handoff: show transcript evidence, speaker confidence, correction reasons, and the editable generated document.
8. Create a JSON config and run `scripts/validate_pipeline_config.py` before connecting real model adapters.

## Procedure
1. Prepare the audio file, metadata, speaker candidate list, optional glossary or reference text, and any externally generated adapter outputs in a local working folder.
2. Create a JSON configuration file with `audio_file`, `metadata`, `speaker_candidates`, `model_settings`, `document.sections`, optional `reference_text` or `reference_files`, and optional `input_paths` for intermediate JSON artifacts.
3. Validate the configuration:
   `python skills/config-driven-audio-minutes-pipeline/scripts/validate_pipeline_config.py --config config.json --check-files`
4. Prepare the workspace and prompt handoff files:
   `python skills/config-driven-audio-minutes-pipeline/scripts/audio_minutes_pipeline.py --config config.json --output-dir out/run-001 --mode prepare`
5. Run or plug in the actual diarization, STT, correction, speaker matching, and document-generation adapters according to the paths declared in the config.
6. Assemble normalized outputs and review artifacts:
   `python skills/config-driven-audio-minutes-pipeline/scripts/audio_minutes_pipeline.py --config config.json --output-dir out/run-001 --mode assemble --force`
7. Validate the result by checking that `speaker_mapped_transcript.json` preserves transcript evidence, `document_generation_prompt.md` contains only grounded source text, unresolved speakers are visible, and the final document is manually reviewed before distribution.

## Failure and exception handling
- Audio is unreadable or too large: reject early, convert to a supported format outside the skeleton, and rerun validation with the converted path.
- Diarization creates many tiny or overlapping segments: tune merge silence, minimum segment duration, and maximum STT segment duration in config before rerunning model adapters.
- STT output lacks required fields: normalize adapter output to the sentence schema before assembly; do not generate a document from free-form transcript text without indices.
- LLM correction rewrites meaning: discard those corrections, tighten the correction prompt, and keep the original sentence unless the error is explicit.
- Speaker matching confidence is low: keep unresolved speaker labels and require human confirmation rather than inventing identities.
- Final document contains unsupported claims: trace each claim back to transcript lines, remove unsupported content, and mark uncertain items as confirmation needed.
- Partial run failure: keep the workspace, inspect stage artifacts, rerun only the failed adapter, then rerun assembly with `--force`.

## Security and privacy precautions
- Never store API keys, model tokens, or portal credentials in config files; use environment variables or a secret manager in the adapter layer.
- Treat audio, transcripts, speaker names, and generated records as sensitive personal or business data; restrict workspace permissions and sharing links.
- Limit reference files to materials the requester is authorized to use, and avoid inserting confidential reference text into prompts unless approved.
- Retain intermediate audio chunks, raw transcripts, corrections, and drafts only for the approved retention window.
- Require human approval before publishing or sending generated records, especially when they include commitments, performance issues, customer statements, or regulated data.
