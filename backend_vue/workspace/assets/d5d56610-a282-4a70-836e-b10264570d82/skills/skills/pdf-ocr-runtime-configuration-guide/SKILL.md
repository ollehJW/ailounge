---
name: pdf-ocr-runtime-configuration-guide
description: Use this whenever the user needs to configure, tune, validate, or migrate a PDF OCR runtime, even if they only mention installation, CPU/GPU choice, dependency issues, OCR language, DPI, thread counts, confidence thresholds, model cache behavior, scanned PDF quality, or output accuracy targets. Trigger proactively for environment changes, batch OCR rollout planning, runtime option decisions, or OCR validation criteria.
---

## Purpose
This skill guides adaptation of a PDF OCR runtime configuration workflow: choosing CPU/GPU execution, dependency setup, page rendering quality, OCR language and threshold options, and validation criteria so scanned or image-based PDFs can be converted into reliable text across different business areas.

## Required inputs
- Execution environment details: operating system, Python version, CPU cores, available GPU model, GPU driver/runtime status, and whether the environment can install native OCR and PDF rendering libraries.
- Target document profile: language(s), expected scan resolution, page count range, orientation/skew issues, image quality, and whether PDFs may already contain searchable text.
- Operational goals: expected batch size, target processing time per document or batch, acceptable error rate, and minimum text completeness criteria.
- Security and operations constraints: document sensitivity, allowed storage locations, model cache policy, internet access restrictions, and retention period for input PDFs and output text.
- For the bundled helper script, confirm Python 3.10+ and PyYAML are available. Use `scripts/validate-ocr-config.py` to validate a YAML OCR configuration before runtime execution.

## Adaptation guide
Decide the runtime and OCR options before writing or changing execution code:

1. Select runtime mode. Use CPU for small batches, restricted environments, or easier deployment; use GPU only when the host has compatible drivers, native libraries, and enough workload to justify initialization overhead.
2. Decide dependency packaging. For GPU mode, align the deep-learning framework package with the installed CUDA/runtime stack; for CPU mode, remove GPU-only dependencies and confirm the OCR engine still supports the selected language model.
3. Define model cache behavior. In offline or controlled networks, pre-stage model files in an approved cache location and disable runtime downloads or remote source checks where supported.
4. Choose input configuration shape. Use a folder input for homogeneous batches; use an explicit file list when PDFs live in multiple locations, have mixed extensions, or require curated processing order.
5. Set language and rendering DPI. Match the OCR language to the dominant document language. Start near 200 DPI for general scans; increase toward 300 DPI for small fonts or low-quality scans; avoid excessive DPI unless accuracy gain is proven.
6. Tune execution options. Set CPU thread count based on available cores and other host workloads. Enable orientation or unwarping features only for documents with rotation, skew, camera capture, or warped pages because these options may increase runtime.
7. Tune detection and recognition thresholds only after baseline testing. Lower thresholds may recover faint text but can add noise; higher thresholds may reduce false positives but miss weak characters.
8. Define output contract. Confirm page separators, text encoding, output naming, and whether downstream systems need one text file per PDF, combined text, or structured extraction after OCR.
9. Define validation criteria. Select a representative sample set, compare OCR text against source pages, track missing lines, incorrect characters, page order, and runtime per page, then document which option set passes the target accuracy and speed goals.
10. Before runtime execution, run `scripts/validate-ocr-config.py` against the proposed YAML to catch invalid option names, type mismatches, missing files, and CPU/GPU profile conflicts.

Example preflight command:

```bash
python skills/pdf-ocr-runtime-configuration-guide/scripts/validate-ocr-config.py --config config.yaml --check-files --profile cpu
```

## Procedure
1. Place the target PDFs in the approved input location, or prepare a YAML file with an explicit `files` list and an `output_dir`.
2. Configure the environment for the chosen profile: activate the Python environment, ensure OCR and PDF rendering packages are installed, and expose GPU native library paths only if running in GPU mode.
3. Run `scripts/validate-ocr-config.py` with `--config`, add `--check-files` when the input files are locally accessible, and set `--profile cpu` or `--profile gpu` to match the intended runtime.
4. If validation reports errors, fix the YAML or environment selection before starting OCR. Warnings may be accepted only if they are documented, such as intentionally high DPI for small-font scans.
5. Execute the adapted OCR workflow with the validated configuration.
6. Confirm that every input PDF has a corresponding text output, filenames match the agreed convention, outputs are UTF-8 readable, and page separators or page order are intact.
7. Validate the result by sampling representative pages, comparing recognized text to the source image, checking for missing sections and obvious substitutions, and recording runtime and quality metrics against the agreed target.

## Failure and exception handling
- Missing or unreadable PDFs: verify paths relative to the YAML file, access permissions, and extension handling; use an explicit file list for nonstandard names.
- No PDFs found in folder mode: confirm the folder path and whether the workflow only matches lowercase `.pdf`; rename files or list them explicitly.
- GPU initialization failure: switch to CPU mode, or reinstall the framework package that matches the host driver/runtime and confirm native library paths are visible before import.
- Native library import errors: rebuild the virtual environment, align Python and binary package versions, and avoid mixing CPU and GPU packages in the same environment.
- Slow processing: reduce DPI, disable orientation or unwarping options when not needed, increase CPU threads within safe limits, or move large batches to GPU-capable hosts.
- Low recognition quality: increase DPI for small or blurred text, enable orientation/skew options for rotated scans, adjust detection or recognition thresholds, and retest on the same validation sample.
- Excessive false positives: raise detection or recognition thresholds and confirm that non-text graphics are not being treated as required output.
- Empty or partial output: inspect whether the source PDF is image-based, encrypted, damaged, or rendered at too low a resolution; retry with higher DPI and review page-level failures.

## Security and privacy precautions
- Do not embed credentials, network paths with secrets, or model repository tokens in YAML files or scripts; use environment variables or approved secret storage.
- Treat input PDFs and extracted text as equally sensitive because OCR can expose personal, financial, contractual, or regulated data that was previously locked in images.
- Store inputs, model caches, temporary rendered images, and outputs only in approved locations with least-privilege access controls.
- If internet access is restricted, pre-stage dependencies and model files through approved channels rather than allowing runtime downloads.
- Apply retention rules to both original PDFs and generated text files; delete temporary render artifacts after processing unless audit policy requires preservation.
- Before sharing OCR outputs downstream, confirm masking, classification, and access rules because extracted text is easier to search, copy, and exfiltrate than scanned images.
