#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

function usage() {
  console.log(`Validate a CSV/XLSX input list before row-by-row automation.\n\nUsage:\n  node scripts/validate-input-list.mjs --input ./targets.xlsx --required-columns "requestDate,requestId" [options]\n\nOptions:\n  --input <file>                 CSV, XLSX, or XLS file to validate.\n  --required-columns <a,b,c>     Required header names after trimming.\n  --date-columns <a,b>           Columns to normalize as dates when possible.\n  --id-column <name>             Column used to detect blank or duplicate business IDs.\n  --output-json <file>           Optional path for a JSON validation report.\n  --help                         Show this help message.`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
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

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
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

function validate({ input, requiredColumns, dateColumns, idColumn }) {
  const rows = readRows(input);
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row).map(normalizeCell)))];
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  const errors = [];
  const warnings = [];
  if (missingColumns.length) errors.push(`Missing required columns: ${missingColumns.join(', ')}`);

  const normalizedRows = rows.map((row, index) => {
    const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeCell(key), normalizeCell(value)]));
    for (const column of dateColumns) {
      if (column in normalized) normalized[column] = normalizeDate(normalized[column]);
    }
    for (const column of requiredColumns) {
      if (!normalizeCell(normalized[column])) errors.push(`Row ${index + 2}: required column is blank: ${column}`);
    }
    return normalized;
  });

  if (idColumn) {
    const seen = new Map();
    normalizedRows.forEach((row, index) => {
      const id = normalizeCell(row[idColumn]);
      if (!id) return;
      if (seen.has(id)) warnings.push(`Duplicate ${idColumn}: ${id} at rows ${seen.get(id) + 2} and ${index + 2}`);
      else seen.set(id, index);
    });
  }

  return {
    ok: errors.length === 0,
    input,
    totalRows: rows.length,
    headers,
    requiredColumns,
    dateColumns,
    idColumn: idColumn || null,
    errors,
    warnings,
    previewRows: normalizedRows.slice(0, 5)
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.input) throw new Error('Missing --input');
  const requiredColumns = splitList(args['required-columns']);
  if (!requiredColumns.length) throw new Error('Missing --required-columns');
  const report = validate({
    input: args.input,
    requiredColumns,
    dateColumns: splitList(args['date-columns']),
    idColumn: args['id-column'] || ''
  });
  if (args['output-json']) {
    fs.mkdirSync(path.dirname(args['output-json']), { recursive: true });
    fs.writeFileSync(args['output-json'], JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(`Validation failed: ${error.message}`);
  process.exit(2);
}
