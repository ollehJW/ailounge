#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import XLSX from 'xlsx';

function usage() {
  console.log(`Run a config-driven row-by-row automation skeleton.\n\nUsage:\n  node scripts/list-workflow-runner.mjs --input ./targets.xlsx --config ./workflow-config.json --output-dir ./artifacts/run-001 [options]\n\nOptions:\n  --input <file>        CSV, XLSX, or XLS input list.\n  --config <file>       JSON config defining requiredColumns, idField, dateFields, resultColumns, and optional processorCommand.\n  --output-dir <dir>    Directory for status-log.jsonl, results.csv, summary.json, and per-row folders.\n  --dry-run             Do not call processorCommand; mark structurally valid rows as successful.\n  --allow-command       Allow processorCommand execution. Without this flag, commands are not run.\n  --help                Show this help message.\n\nProcessor contract:\n  The command receives one row JSON document on stdin. Exit code 0 means success; non-zero means failure.`);
}

function parseArgs(argv) {
  const args = { dryRun: false, allowCommand: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--allow-command') args.allowCommand = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
      args[key] = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function normalizeCell(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function parseCsv(buffer) {
  const rows = parseCsvRows(buffer.toString('utf8')).filter((row) => row.some((cell) => normalizeCell(cell)));
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeCell);
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])));
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeCell(key), normalizeCell(value)])));
}

function readRows(input) {
  const extension = path.extname(input).toLowerCase();
  const buffer = fs.readFileSync(input);
  if (extension === '.csv') return parseCsv(buffer);
  if (['.xlsx', '.xls'].includes(extension)) return parseWorkbook(buffer);
  throw new Error(`Unsupported input extension: ${extension}. Use .csv, .xlsx, or .xls.`);
}

function normalizeDate(value) {
  const text = normalizeCell(value);
  const match = text.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);
  if (!match) return text;
  const [year, month, day] = match[0].split(/[-/.]/);
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function safeName(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  fs.writeFileSync(file, `\uFEFF${lines.join('\r\n')}`);
}

function loadConfig(file) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(config.requiredColumns) || !config.requiredColumns.length) throw new Error('Config must include requiredColumns array.');
  if (!config.idField) throw new Error('Config must include idField.');
  return {
    dateFields: [],
    resultColumns: [],
    successWhenColumnsPresent: [],
    ...config
  };
}

function prepareRows(rows, config) {
  const headers = new Set(rows.flatMap((row) => Object.keys(row).map(normalizeCell)));
  const missing = config.requiredColumns.filter((column) => !headers.has(column));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

  return rows.map((row, index) => {
    const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeCell(key), normalizeCell(value)]));
    for (const column of config.dateFields) {
      if (column in normalized) normalized[column] = normalizeDate(normalized[column]);
    }
    const errors = [];
    for (const column of config.requiredColumns) {
      if (!normalizeCell(normalized[column])) errors.push(`Blank required column: ${column}`);
    }
    return { index, rowNumber: index + 2, data: normalized, validationErrors: errors };
  });
}

function runCommand(command, rowPayload) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    child.stdin.end(JSON.stringify(rowPayload));
  });
}

function appendStatus(logFile, event) {
  fs.appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function resultValue(row, column) {
  if (column in row.data) return row.data[column];
  return row[column] ?? '';
}

async function processRows({ items, config, outputDir, dryRun, allowCommand }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const logFile = path.join(outputDir, 'status-log.jsonl');
  fs.writeFileSync(logFile, '');
  const results = [];

  for (const item of items) {
    const id = normalizeCell(item.data[config.idField]) || `row-${item.rowNumber}`;
    const outputFolder = path.join(outputDir, safeName(id));
    fs.mkdirSync(outputFolder, { recursive: true });
    const base = { ...item, id, outputFolder, status: 'running', message: '' };
    appendStatus(logFile, { rowNumber: item.rowNumber, id, status: 'running' });

    if (item.validationErrors.length) {
      base.status = 'fail';
      base.message = item.validationErrors.join('; ');
    } else if (dryRun) {
      base.status = 'ok';
      base.message = 'Dry run passed validation.';
    } else if (config.processorCommand && allowCommand) {
      const commandResult = await runCommand(config.processorCommand, { row: item.data, id, outputFolder });
      base.status = commandResult.ok ? 'ok' : 'fail';
      base.message = commandResult.ok ? (commandResult.stdout || 'Processor completed.') : (commandResult.stderr || commandResult.stdout || `Processor exited with code ${commandResult.code}`);
    } else if (config.processorCommand && !allowCommand) {
      base.status = 'fail';
      base.message = 'processorCommand is configured, but --allow-command was not provided.';
    } else {
      const missingEvidence = config.successWhenColumnsPresent.filter((column) => !normalizeCell(item.data[column]));
      base.status = missingEvidence.length ? 'fail' : 'ok';
      base.message = missingEvidence.length ? `Missing success evidence columns: ${missingEvidence.join(', ')}` : 'No processor configured; column evidence passed.';
    }

    appendStatus(logFile, { rowNumber: item.rowNumber, id, status: base.status, message: base.message });
    results.push(base);
  }

  const defaultColumns = [config.idField, ...config.requiredColumns.filter((column) => column !== config.idField), 'status', 'message', 'outputFolder'];
  const columns = config.resultColumns.length ? config.resultColumns : [...new Set(defaultColumns)];
  const csvRows = results.map((row) => Object.fromEntries(columns.map((column) => [column, resultValue(row, column)])));
  writeCsv(path.join(outputDir, 'results.csv'), csvRows, columns);

  const summary = {
    total: results.length,
    ok: results.filter((row) => row.status === 'ok').length,
    fail: results.filter((row) => row.status === 'fail').length,
    outputDir,
    resultsCsv: path.join(outputDir, 'results.csv'),
    statusLog: logFile
  };
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.input) throw new Error('Missing --input');
  if (!args.config) throw new Error('Missing --config');
  if (!args['output-dir']) throw new Error('Missing --output-dir');

  const config = loadConfig(args.config);
  const rows = readRows(args.input);
  const items = prepareRows(rows, config);
  const summary = await processRows({
    items,
    config,
    outputDir: args['output-dir'],
    dryRun: args.dryRun,
    allowCommand: args.allowCommand
  });
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail ? 1 : 0);
} catch (error) {
  console.error(`Workflow run failed: ${error.message}`);
  process.exit(2);
}
