---
name: config-driven-pdf-ocr-pipeline
description: Use this whenever the user needs a configurable batch OCR pipeline for scanned or image-based PDFs, even if they only mention document extraction, changing input folders, file lists, OCR language, DPI, CPU/GPU runtime, validation rules, or output text contracts. Trigger proactively when adapting PDF-to-text automation across environments or business workflows.
---

## Purpose
Automate a reusable PDF OCR workflow that reads a YAML configuration, normalizes PDF inputs, renders pages as images, runs OCR, and writes page-separated text outputs so the same pattern can be adapted for scanned forms, reports, contracts, records, or other document-heavy workflows.

## Required inputs
- PDF input source: either one folder containing PDFs or an explicit list of PDF files.
- Output directory and file naming rule, such as `{stem}.txt` or a controlled subfolder template.
- OCR operating settings: language, render DPI, CPU/GPU selection, thread count, and any engine-specific detection or recognition thresholds.
- Document quality assumptions that affect preprocessing choices, such as rotated pages, warped scans, small text, low contrast, or mixed languages.
- Runtime environment with Python 3.10+ and the script dependencies for YAML parsing, PDF rendering, numeric image arrays, the OCR engine module, and the matching CPU/GPU compute runtime. Use `scripts/pdf_ocr_pipeline.py --check-only` before running OCR to validate the configuration without processing documents.

## Adaptation guide
Decide the workflow contract before coding or running the pipeline:
1. Select the input mode: use `folder` for recurring batch drops, or `files` for curated document sets. Avoid mixing both in one config.
2. Define output naming with `output_dir` and optional `output_template`; keep generated paths inside the output directory and preserve a predictable one-input-to-one-output relationship.
3. Choose OCR options for the target document type: start with moderate DPI, increase only for small or faint text, enable orientation or unwarping options only when sample pages show those issues, and choose CPU/GPU based on volume and infrastructure.
4. Set operational behavior: decide whether a single failed PDF should stop the run or be recorded while the batch continues using `continue_on_error`.
5. Define acceptance checks: sample a small set of representative pages, compare extracted text to the visible source, record missing fields or repeated OCR errors, then adjust DPI, language, orientation, and threshold options before scaling.
6. Use `scripts/pdf_ocr_pipeline.py` as the executable skeleton. Read it when adapting the accepted YAML keys, option type rules, output path policy, page separator format, or per-file manifest fields.

## Procedure
1. Create a YAML file with `folder` or `files`, `output_dir`, optional `output_template`, optional `continue_on_error`, and an `options` mapping.
2. Validate configuration and paths without OCR:
   `python skills/config-driven-pdf-ocr-pipeline/scripts/pdf_ocr_pipeline.py --config config.yaml --check-only`
3. Confirm the runtime has the selected CPU/GPU packages installed and that the process can read input PDFs and write to the output directory.
4. Execute the batch:
   `python skills/config-driven-pdf-ocr-pipeline/scripts/pdf_ocr_pipeline.py --config config.yaml`
5. Review the generated `.txt` files and `ocr_manifest.json` in the output directory. Validate the result by checking that each expected PDF has a manifest entry, page headings are present, output text is non-empty for readable pages, and sampled text matches the source within the workflow’s accepted error tolerance.

## Failure and exception handling
- Config contains both `folder` and `files`, neither input mode, unknown OCR options, or invalid option types: stop and correct the YAML before execution.
- Input folder is missing, file list contains non-PDFs, or a path does not exist: fix the path mapping or regenerate the input list; do not silently skip documents unless the workflow explicitly permits it.
- OCR engine initialization fails: verify installed runtime packages, CPU/GPU compatibility, language model availability, and whether the environment is allowed to load cached model files.
- PDF rendering fails for encrypted, corrupt, or very large files: isolate the file, repair or unlock it through approved channels, or lower DPI if memory pressure is the cause.
- Output text is empty or low quality: validate whether the source page is image-based and readable, then retry representative samples with adjusted DPI, language, orientation/unwarping, or recognition thresholds before rerunning the full batch.
- A single file fails during a batch: if `continue_on_error` is true, inspect the manifest error field and reprocess only failed files after remediation; otherwise rerun after fixing the blocking file.

## Security and privacy precautions
- Keep PDFs, extracted text, and manifests in approved storage locations because OCR output can expose sensitive content that was previously locked inside images.
- Do not embed credentials, network paths with secrets, or private tokens in YAML files; use environment-level access controls for protected storage.
- Restrict output directory permissions to the same audience allowed to view the source PDFs.
- Apply retention rules to both original PDFs and generated text, including temporary rendered images if the script is extended to persist them.
- Avoid sending documents to external services unless the workflow owner has approved the data classification, transfer mechanism, and audit requirements.
