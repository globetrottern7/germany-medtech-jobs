'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '..', '..');
const abs = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(abs(p));

function readJson(p, fallback) {
  if (!exists(p)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${p}`);
  }
  return JSON.parse(fs.readFileSync(abs(p), 'utf8'));
}

// Preserves the existing layout of a file: single-line (compact) files stay compact so diffs stay small.
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
  const compact = exists(p) && !fs.readFileSync(abs(p), 'utf8').trimEnd().includes('\n');
  fs.writeFileSync(abs(p), compact ? JSON.stringify(data) : JSON.stringify(data, null, 2) + '\n');
}

function readJsonl(p) {
  if (!exists(p)) return [];
  return fs.readFileSync(abs(p), 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function writeJsonl(p, rows) {
  fs.writeFileSync(abs(p), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

function appendJsonl(p, rows) {
  if (!rows.length) return;
  fs.appendFileSync(abs(p), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// Minimal RFC4180 CSV reader/writer (quoted fields, embedded commas/quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

function readCsv(p) {
  return exists(p) ? parseCsv(fs.readFileSync(abs(p), 'utf8')) : [];
}

function writeCsv(p, rows, cols) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  fs.writeFileSync(abs(p), [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n');
}

module.exports = { ROOT, abs, exists, readJson, writeJson, readJsonl, writeJsonl, appendJsonl, parseCsv, readCsv, writeCsv };
