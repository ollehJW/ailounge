---
name: audio-transcript-postprocessing-pipeline
description: Use this whenever the user needs to adapt or run an audio transcript pipeline that performs diarization, segment cleanup, speech-to-text, LLM-based transcript correction, or speaker matching. Trigger even if they only mention changing audio inputs, participant lists, model paths, batch sizes, prompts, environments, validation rules, or transcript output contracts.
---

## Purpose
This skill provides a reusable skeleton for turning an audio file into speaker-attributed transcript records by chaining speaker diarization, segment normalization, speech-to-text, conservative LLM correction, and participant-based speaker matching; the pattern applies to meetings, interviews, consultations, calls, and any business workflow that needs auditable spoken-record postprocessing.

## Required inputs
- Audio file path or uploaded audio file that the runtime can read.
- Participant list as comma-separated text or a text file path.
- Meeting purpose or business context to guide conservative correction.
- Optional reference text used as a domain glossary for terminology correction.
- STT model path, diarization model identifier or path, LLM endpoint settings, batch sizes, language, and segment thresholds in a JSON config or environment variables.
- Runtime dependencies when executing the full skeleton: Python 3.10+, torch, torchaudio, pyannote.audio, qwen-asr or a compatible ASR package, openai, and model access tokens where required.

## Adaptation guide
Decide the target workflow contract before writing integration code. Configure access through environment variables rather than source edits: diarization token, LLM API key, endpoint, deployment name, and API version. Map the input contract to one canonical audio path plus participant, context, and optional reference text. Tune segment behavior for the domain: maximum silence for same-speaker merging, minimum segment duration, maximum STT chunk length, batch size, and ASR language. Decide whether speaker names may be automatically accepted or must go through human review before publishing. Define output rules for JSON files, retention duration, and whether original, corrected, and mapped transcripts are all retained for audit.

Checklist before adaptation:
- Confirm the earliest input is raw audio, not a prebuilt transcript, unless the target workflow intentionally bypasses diarization and STT.
- Choose model paths and tokens for the deployment environment and verify whether offline model loading is required.
- Normalize participant input to one display string per person or role; avoid free-form names that should not be used for matching.
- Define correction boundaries: only clear transcription mistakes should change, not meaning, tone, or summary.
- Decide fallback behavior for low-confidence matches, such as keeping generic speaker labels.
- Use `scripts/audio_pipeline.py --write-example-config pipeline_config.example.json` to generate a configurable starting point, then edit only environment-specific values.

## Procedure
1. Place the audio file and optional reference text where the runtime can access them.
2. Export required secrets and endpoints, or load them through a local `.env` file excluded from source control.
3. Run helper validation before full processing: `python skills/audio-transcript-postprocessing-pipeline/scripts/audio_pipeline.py --config pipeline_config.json --audio input.wav --participants participants.txt --context project-review --output-dir out/run-001 --validate-only`.
4. Execute the workflow: `python skills/audio-transcript-postprocessing-pipeline/scripts/audio_pipeline.py --config pipeline_config.json --audio input.wav --participants participants.txt --context project-review --reference-text glossary.txt --output-dir out/run-001`.
5. Use `--skip-llm` only when validating diarization and STT without correction or participant matching.
6. Validate the result by checking that `stt_result.json`, `original_result.json`, `stt_corrections.json`, `speaker_matches.json`, `refined_result.json`, and `pipeline_summary.json` exist in the output directory; inspect low-confidence speaker matches and confirm corrected text still preserves the original meaning.

## Failure and exception handling
- Missing audio or unreadable format: convert to a supported waveform format and rerun validation before executing.
- Missing diarization token or inaccessible model: set the configured token environment variable or switch the config to a locally available diarization model.
- GPU or memory exhaustion: reduce STT batch size, shorten maximum STT segment duration, or run on CPU with lower throughput expectations.
- Empty or fragmented speaker segments: lower the minimum segment duration cautiously, review merge silence, and inspect audio quality.
- Invalid LLM JSON output: rerun the LLM postprocess stage, reduce correction batch size, or bypass with `--skip-llm` while retaining raw STT output.
- Low-confidence speaker matching: keep generic speaker labels or route `speaker_matches.json` to manual review before publishing.

## Security and privacy precautions
Keep API keys, model tokens, and endpoints in environment variables or untracked `.env` files. Treat audio, transcripts, participant lists, and reference text as sensitive because they may contain personal data, business decisions, or regulated information. Restrict output directory access, set retention rules for intermediate JSON artifacts, and remove raw audio or original transcripts when audit policy does not require them. Do not send reference text or transcripts to an external LLM unless the data classification and vendor agreement allow it.
