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

function templateConfig() {
  return {
    portal: { startUrl: 'https://portal.example.com/documents', viewport: { width: 1365, height: 900 } },
    input: { idColumn: 'businessId', outputFolderTemplate: '{{businessId}}' },
    login: {
      enabled: true,
      steps: [
        { action: 'fill', selector: 'input[name="username"]', value: '{{env.PORTAL_USER}}' },
        { action: 'fill', selector: 'input[name="password"]', value: '{{env.PORTAL_PASSWORD}}' },
        { action: 'click', selector: 'button[type="submit"]' },
        { action: 'waitForSelector', selector: '#mainContent', timeoutMs: 30000 }
      ]
    },
    search: {
      steps: [
        { action: 'fill', selector: 'input[name="keyword"]', value: '{{businessId}}' },
        { action: 'click', selector: 'button.search' },
        { action: 'waitForSelector', selector: '.result-row, .no-result', timeoutMs: 30000 },
        { action: 'click', selector: '.result-row:first-child' }
      ],
      noResultSelector: '.no-result',
      successSelector: '.detail-page'
    },
    downloads: {
      triggers: ['a.download-attachment'],
      timeoutMs: 30000,
      filenameIncludes: ['document'],
      filenameExcludes: [],
      filenameRegex: '',
      keepNonMatching: false
    }
  };
}

function help() {
  return `Run a config-driven portal document collection skeleton.

Usage:
  node collect-documents.mjs --config ./collector.config.json --input ./targets.csv --out-dir ./downloads --headless true
  node collect-documents.mjs --print-config-template > collector.config.json

Flags:
  --config                 JSON config file
  --input                  CSV/XLSX target list
  --out-dir                Output directory for folders and result files
  --headless               true or false; default true
  --dry-run                Validate mapping without opening a browser
  --print-config-template  Print a starter config JSON
`;
}

function normalize(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function safeName(value) {
  const cleaned = normalize(value).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'unknown';
}

function splitCsvRows(text) {
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

function csvToObjects(buffer) {
  const rows = splitCsvRows(buffer.toString('utf8')).filter((row) => row.some((cell) => normalize(cell)));
  if (!rows.length) return [];
  const headers = rows[0].map(normalize);
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalize(row[index])])));
}

async function xlsxToObjects(buffer) {
  let XLSX;
  try { XLSX = await import('xlsx'); }
  catch { throw new Error('The xlsx package is required for Excel files. Install it with: npm install xlsx'); }
  const workbook = XLSX.default.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.default.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), normalize(value)])));
}

async function readRows(file) {
  const extension = path.extname(file).toLowerCase();
  const buffer = fs.readFileSync(file);
  if (extension === '.csv') return csvToObjects(buffer);
  if (['.xlsx', '.xls'].includes(extension)) return xlsxToObjects(buffer);
  throw new Error('Unsupported input extension. Use CSV, XLSX, or XLS.');
}

function interpolate(value, row) {
  if (typeof value !== 'string') return value;
  return value.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const name = key.trim();
    if (name.startsWith('env.')) return process.env[name.slice(4)] || '';
    return row[name] ?? '';
  });
}

async function runAction(page, action, row) {
  const kind = action.action;
  const selector = interpolate(action.selector || '', row);
  const value = interpolate(action.value || '', row);
  const timeout = Number(action.timeoutMs || 15000);
  if (kind === 'goto') return page.goto(interpolate(action.url, row), { waitUntil: 'domcontentloaded', timeout });
  if (kind === 'fill') return page.locator(selector).first().fill(value, { timeout });
  if (kind === 'click') return page.locator(selector).first().click({ timeout });
  if (kind === 'press') return page.locator(selector).first().press(value || 'Enter', { timeout });
  if (kind === 'selectOption') return page.locator(selector).first().selectOption(value, { timeout });
  if (kind === 'waitForSelector') return page.locator(selector).first().waitFor({ state: action.state || 'visible', timeout });
  if (kind === 'waitForTimeout') return page.waitForTimeout(Number(action.timeoutMs || 1000));
  throw new Error(`Unsupported action: ${kind}`);
}

async function isVisible(page, selector, timeoutMs = 750) {
  if (!selector) return false;
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  } catch { return false; }
}

function filenameAllowed(filename, rules = {}) {
  const name = String(filename || '');
  const includes = rules.filenameIncludes || [];
  const excludes = rules.filenameExcludes || [];
  if (includes.length && !includes.some((part) => name.includes(part))) return false;
  if (excludes.some((part) => name.includes(part))) return false;
  if (rules.filenameRegex && !(new RegExp(rules.filenameRegex).test(name))) return false;
  return true;
}

function nextAvailablePath(dir, filename) {
  const parsed = path.parse(safeName(filename));
  let candidate = path.join(dir, `${parsed.name}${parsed.ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${parsed.name}_${index}${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeResults(outDir, results) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, results }, null, 2));
  const rows = [['id', 'status', 'message', 'fileCount', 'files'], ...results.map((item) => [item.id, item.status, item.message || '', item.files.length, item.files.join('; ')])];
  fs.writeFileSync(path.join(outDir, 'result.csv'), rows.map((row) => row.map(csvEscape).join(',')).join('\r\n'));
}

async function collectForRow(page, config, row, outDir) {
  const idColumn = config.input?.idColumn || 'businessId';
  const id = normalize(row[idColumn]);
  if (!id) return { id: '', status: 'fail', message: `Missing identifier column: ${idColumn}`, files: [] };

  for (const step of config.search?.steps || []) await runAction(page, step, row);
  if (await isVisible(page, config.search?.noResultSelector)) return { id, status: 'fail', message: 'No result indicator was visible', files: [] };
  if (config.search?.successSelector && !(await isVisible(page, config.search.successSelector, 5000))) return { id, status: 'fail', message: 'Success selector was not visible', files: [] };

  const folderTemplate = config.input?.outputFolderTemplate || `{{${idColumn}}}`;
  const folder = path.join(outDir, safeName(interpolate(folderTemplate, row)));
  fs.mkdirSync(folder, { recursive: true });

  const triggers = config.downloads?.triggers || (config.downloads?.triggerSelector ? [config.downloads.triggerSelector] : []);
  const files = [];
  for (const trigger of triggers) {
    const selector = typeof trigger === 'string' ? trigger : trigger.selector;
    const timeout = Number(config.downloads?.timeoutMs || 30000);
    const downloadPromise = page.waitForEvent('download', { timeout }).catch(() => null);
    await page.locator(interpolate(selector, row)).first().click({ timeout });
    const download = await downloadPromise;
    if (!download) continue;
    const suggested = download.suggestedFilename();
    if (!filenameAllowed(suggested, config.downloads || {})) {
      if (config.downloads?.keepNonMatching) {
        const savedTo = nextAvailablePath(folder, `filtered_${suggested}`);
        await download.saveAs(savedTo);
      }
      continue;
    }
    const savedTo = nextAvailablePath(folder, suggested);
    await download.saveAs(savedTo);
    const stats = fs.statSync(savedTo);
    if (stats.size > 0) files.push(savedTo);
  }

  return files.length
    ? { id, status: 'ok', message: 'Downloaded', files }
    : { id, status: 'fail', message: 'No matching non-empty download was saved', files: [] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args['print-config-template']) {
    console.log(JSON.stringify(templateConfig(), null, 2));
    return;
  }
  if (args.help || !args.config || !args.input || !args['out-dir']) {
    console.log(help());
    process.exit(args.help ? 0 : 1);
  }

  const config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
  const outDir = args['out-dir'];
  const rows = await readRows(args.input);
  const idColumn = config.input?.idColumn || 'businessId';
  const mapped = rows.map((row) => ({ id: normalize(row[idColumn]), folder: safeName(interpolate(config.input?.outputFolderTemplate || `{{${idColumn}}}`, row)) }));

  if (args['dry-run']) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'dry-run-mapping.json'), JSON.stringify({ rowCount: rows.length, idColumn, mapped }, null, 2));
    console.log(JSON.stringify({ ok: true, dryRun: true, rowCount: rows.length, savedTo: path.join(outDir, 'dry-run-mapping.json') }, null, 2));
    return;
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: String(args.headless ?? 'true') !== 'false' });
  const context = await browser.newContext({ acceptDownloads: true, viewport: config.portal?.viewport || { width: 1365, height: 900 } });
  const page = await context.newPage();
  const results = [];

  try {
    await page.goto(config.portal.startUrl, { waitUntil: 'domcontentloaded', timeout: Number(config.portal.timeoutMs || 60000) });
    if (config.login?.enabled !== false) {
      for (const step of config.login?.steps || []) await runAction(page, step, {});
    }
    for (const row of rows) {
      try { results.push(await collectForRow(page, config, row, outDir)); }
      catch (error) { results.push({ id: normalize(row[idColumn]), status: 'fail', message: error.message, files: [] }); }
      writeResults(outDir, results);
    }
  } finally {
    await browser.close();
  }

  writeResults(outDir, results);
  const okCount = results.filter((item) => item.status === 'ok').length;
  console.log(JSON.stringify({ ok: okCount === results.length, total: results.length, okCount, failedCount: results.length - okCount, outDir }, null, 2));
  if (okCount !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
