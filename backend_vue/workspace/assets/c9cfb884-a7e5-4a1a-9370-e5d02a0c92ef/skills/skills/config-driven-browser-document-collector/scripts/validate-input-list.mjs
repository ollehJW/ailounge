#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

function help() {
  return `Validate a CSV/XLSX target list for portal document collection.

Usage:
  node validate-input-list.mjs --input ./targets.csv --columns "businessId,requestDate" --date-columns "requestDate" --id-column businessId

Flags:
  --input          CSV/XLSX file to validate
  --columns        Comma-separated required column names
  --date-columns   Optional comma-separated date columns to validate
  --id-column      Optional identifier column checked for blanks and duplicates
`;
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') { value += '"'; i += 1; }
      else if (char === '"') inQuotes = false;
      else value += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value); rows.push(row); row = []; value = ''; }
    else if (char !== '\r') value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function normalize(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function csvToObjects(buffer) {
  const rows = parseCsvRows(buffer.toString('utf8')).filter((row) => row.some((cell) => normalize(cell)));
  if (!rows.length) return [];
  const headers = rows[0].map(normalize);
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalize(row[index])])));
}

async function xlsxToObjects(buffer) {
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('The xlsx package is required for Excel files. Install it with: npm install xlsx');
  }
  const workbook = XLSX.default.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.default.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), normalize(value)])));
}

async function readObjects(file) {
  const extension = path.extname(file).toLowerCase();
  const buffer = fs.readFileSync(file);
  if (extension === '.csv') return csvToObjects(buffer);
  if (['.xlsx', '.xls'].includes(extension)) return xlsxToObjects(buffer);
  throw new Error('Unsupported input extension. Use CSV, XLSX, or XLS.');
}

function isValidDateLike(value) {
  const text = normalize(value);
  if (!text) return false;
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return false;
  const date = new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input || !args.columns) {
    console.log(help());
    process.exit(args.help ? 0 : 1);
  }

  const requiredColumns = splitList(args.columns);
  const dateColumns = splitList(args['date-columns']);
  const idColumn = args['id-column'] ? String(args['id-column']) : '';
  const rows = await readObjects(args.input);
  const headers = new Set(rows.flatMap((row) => Object.keys(row).map(normalize)));
  const issues = [];

  for (const column of requiredColumns) {
    if (!headers.has(column)) issues.push({ level: 'error', type: 'missing_column', column });
  }

  const seenIds = new Map();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    for (const column of requiredColumns) {
      if (!normalize(row[column])) issues.push({ level: 'warning', type: 'blank_required_value', rowNumber, column });
    }
    for (const column of dateColumns) {
      if (row[column] !== undefined && !isValidDateLike(row[column])) issues.push({ level: 'warning', type: 'invalid_date', rowNumber, column, value: normalize(row[column]) });
    }
    if (idColumn) {
      const id = normalize(row[idColumn]);
      if (!id) issues.push({ level: 'error', type: 'blank_identifier', rowNumber, column: idColumn });
      else if (seenIds.has(id)) issues.push({ level: 'warning', type: 'duplicate_identifier', rowNumber, firstRowNumber: seenIds.get(id), value: id });
      else seenIds.set(id, rowNumber);
    }
  });

  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const warningCount = issues.filter((issue) => issue.level === 'warning').length;
  const summary = { ok: errorCount === 0, input: args.input, rowCount: rows.length, requiredColumns, dateColumns, idColumn, errorCount, warningCount, issues };
  console.log(JSON.stringify(summary, null, 2));
  if (errorCount) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
