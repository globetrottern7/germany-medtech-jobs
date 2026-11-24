'use strict';
// End-to-end: run the pipeline offline on a temporary copy of the repository and validate it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');

test('offline daily run produces a publication that passes validation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'medtech-run-'));
  for (const d of ['data', 'state', 'scripts']) fs.cpSync(path.join(root, d), path.join(tmp, d), { recursive: true });
  const env = { ...process.env, REPO_ROOT: tmp };
  delete env.GITHUB_STEP_SUMMARY;
  const date = '2099-01-01';
  execFileSync(process.execPath, [path.join(tmp, 'scripts/daily-run.js'), '--offline', '--date', date], { env, cwd: tmp });
  const out = execFileSync(process.execPath, [path.join(tmp, 'scripts/validate-publication.js')], { env, cwd: tmp }).toString();
  assert.match(out, new RegExp(`latest date ${date}`));
  const history = JSON.parse(fs.readFileSync(path.join(tmp, 'data/daily-history.json'), 'utf8')).entries;
  const dates = history.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort(), 'history sorted');
  assert.equal(new Set(dates).size, dates.length, 'no duplicate history dates');
  assert.ok(history.some((e) => e.reportStatus === 'MISSED'), 'missed runs recorded');
  // Idempotent: a second run for the same date is a no-op.
  const before = fs.readFileSync(path.join(tmp, 'data/reports.json'), 'utf8');
  execFileSync(process.execPath, [path.join(tmp, 'scripts/daily-run.js'), '--offline', '--date', date], { env, cwd: tmp });
  assert.equal(fs.readFileSync(path.join(tmp, 'data/reports.json'), 'utf8'), before);
  fs.rmSync(tmp, { recursive: true, force: true });
});
