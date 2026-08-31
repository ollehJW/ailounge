---
name: audio-transcript-postprocessing-pipeline
description: Use this whenever the user needs to adapt or run an audio-to-transcript postprocessing workflow, even if they do not explicitly ask for this skill. Trigger when they mention audio recordings, diarization, speaker segmentation, STT, transcript correction, participant-based speaker matching, batch sizes, model paths, LLM API settings, transcript output schemas, or reviewable meeting/interview/call records.
---

## Purpose
This skill provides a reusable, configuration-driven skeleton for converting an audio recording into normalized speaker-attributed transcript data, correcting likely STT errors with an LLM, and matching detected speakers to participant candidates. The same pattern can be adapted for meetings, interviews, briefings, customer calls, training sessions, and other spoken-record workflows.

## Required inputs
- Audio or recording file path.
- Participant list and session purpose; optionally include reference text such as agenda, glossary, project terms, or domain vocabulary.
- STT model path or identifier and speaker diarization model path or identifier.
- LLM API connection settings through environment variables, not hardcoded values.
- Processing parameters: merge silence threshold, minimum segment length, maximum STT segment duration, STT batch size, and LLM correction batch size.
- Runtime dependencies for the executable skeleton: Python with torch, torchaudio, pyannote.audio, qwen-asr-compatible ASR runtime, openai, and any required local or remote model access tokens.

## Adaptation guide
Decide the workflow contract before changing code. First, define the target input contract: accepted audio formats, maximum duration, language, expected channel layout, and where files are staged. Second, choose model access mode: local/offline model paths or remote identifiers, GPU or CPU execution, and which environment variable supplies the diarization token. Third, map the participant input format to a plain text list that the LLM can use without inventing names. Fourth, tune segmentation behavior: larger merge silence reduces fragmented turns, minimum duration drops noise, and maximum STT segment duration prevents long inference calls. Fifth, set LLM correction rules so corrections preserve the original utterance and only fix clear recognition errors supported by context. Sixth, define speaker matching rules: use only participant candidates or an explicit unknown-speaker label. Seventh, choose output files and downstream schema expectations before adding integrations. Eighth, decide whether a reviewer can override speaker matches and where override mappings are stored. Use scripts/validate_pipeline_config.py before running a new adaptation, and use scripts/run_audio_transcript_pipeline.py as the executable skeleton once the configuration decisions are complete.

## Procedure
Prepare a JSON configuration file and, if useful, create a starter file with `python skills/audio-transcript-postprocessing-pipeline/scripts/validate_pipeline_config.py --write-sample pipeline-config.json`. Set the LLM and model-access environment variables referenced by the configuration. Run validation with `python skills/audio-transcript-postprocessing-pipeline/scripts/validate_pipeline_config.py --config pipeline-config.json --audio sample.wav --participants participants.txt`. Execute the pipeline with `python skills/audio-transcript-postprocessing-pipeline/scripts/run_audio_transcript_pipeline.py --config pipeline-config.json --audio sample.wav --output-dir out/session1 --participants participants.txt --purpose 'weekly planning' --reference-text glossary.txt`. Review the generated `raw_result.json`, `original_result.json`, `stt_corrections.json`, `speaker_matches.json`, and `refined_result.json`. Validate the result by checking that segment times are ordered, corrected utterances still preserve the original meaning, speaker names come only from the participant list or unknown labels, and the refined transcript is complete enough for downstream summarization or archiving.

## Failure and exception handling
- Missing audio file or unreadable format: convert the recording to a supported waveform format and rerun validation.
- Missing model token or restricted diarization model: set the configured token environment variable or switch to a local model path with access already granted.
- GPU memory exhaustion: lower STT batch size, shorten maximum STT segment duration, use CPU mode if acceptable, or split long recordings before processing.
- Empty or fragmented diarization output: adjust minimum segment duration and merge silence thresholds; confirm the audio has speech and acceptable signal quality.
- ASR dependency unavailable: install the configured ASR runtime or replace the ASR adapter in the skeleton while keeping the same sentence output schema.
- Invalid LLM JSON: rerun the affected correction or speaker matching step, inspect prompts and transcript length, and reduce correction batch size if responses are truncated.
- Poor speaker matching: provide a richer participant list with roles, add agenda or glossary text, or apply a reviewer-approved mapping after inspecting evidence.

## Security and privacy precautions
Store API keys, model tokens, and endpoints only in environment variables or ignored local environment files. Treat audio, transcripts, participant lists, and reference materials as sensitive because they may contain personal, business, or regulated information. Restrict access to output directories, avoid sending confidential data to an LLM endpoint that is not approved for the data class, and redact or minimize reference text when possible. Apply retention rules to intermediate files such as raw transcripts, corrections, and speaker match evidence; delete temporary audio and generated artifacts when they are no longer needed.
