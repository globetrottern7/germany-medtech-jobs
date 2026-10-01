#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root,p), "utf8"));
const fail = (m) => { console.error("PUBLICATION_VALIDATION_FAILED:", m); process.exitCode = 1; };

const jobs = readJson("data/jobs.json");
const reports = readJson("data/reports.json").reports;
const history = readJson("data/daily-history.json").entries;

if (!Array.isArray(jobs.jobs) || !Array.isArray(reports) || !Array.isArray(history)) {
  fail("Core data arrays are missing or malformed."); process.exit();
}

const latest = history[history.length - 1];
if (!latest?.date) { fail("History has no latest date."); process.exit(); }

const dailyPath = `data/daily/${latest.date}.json`;
if (!fs.existsSync(path.join(root,dailyPath))) {
  fail(`Latest history date ${latest.date} has no dated daily report.`); process.exit();
}
const daily = readJson(dailyPath);
const report = reports.find(r => r.date === latest.date);

if (latest.reportStatus === "PUBLISHED" && !report) fail(`PUBLISHED date ${latest.date} is absent from data/reports.json.`);
if (report && daily.reportType === "normal daily") {
  const keys = ["activeJobs","freshJobs","previouslyListed","closingWithin7Days","newGatePassing","provisionalFindings"];
  for (const k of keys) {
    if (daily[k] !== undefined && report[k] !== undefined && daily[k] !== report[k]) fail(`${latest.date}: ${k} differs between dated report and reports index.`);
  }
  const same = (a,b) => JSON.stringify([...(a||[])].sort()) === JSON.stringify([...(b||[])].sort());
  if (!same(daily.jobIds, report.jobIds)) fail(`${latest.date}: jobIds differ between dated report and reports index.`);
  if (!same(daily.freshJobIds, report.freshJobIds)) fail(`${latest.date}: freshJobIds differ between dated report and reports index.`);
  if (!same(daily.excludedJobIds, report.excludedJobIds)) fail(`${latest.date}: excludedJobIds differ between dated report and reports index.`);
}

if (daily.reportType === "normal daily") {
  const activeSet = new Set(jobs.jobs.filter(j => j.status === "active").map(j => j.id));
  const ids = daily.jobIds || [];
  const missing = ids.filter(id => !activeSet.has(id));
  if (missing.length) fail(`${daily.date}: published IDs not present in active jobs: ${missing.join(", ")}`);
  if (ids.length !== daily.activeJobs) fail(`${daily.date}: activeJobs count does not equal jobIds length.`);
  if ((daily.freshJobIds||[]).some(id => !ids.includes(id))) fail(`${daily.date}: freshJobIds contains non-published ID.`);
  if ((daily.freshJobIds||[]).length !== daily.freshJobs) fail(`${daily.date}: freshJobs count does not equal freshJobIds length.`);
  if ((daily.previouslyListed||0) + (daily.freshJobs||0) !== daily.activeJobs) fail(`${daily.date}: fresh + previouslyListed != activeJobs.`);
  const closing = jobs.jobs.filter(j => j.status==="active" && j.deadline && new Date(j.deadline+"T23:59:59Z") < new Date(daily.date+"T00:00:00Z")).map(j=>j.id);
  if (closing.length) fail(`${daily.date}: active jobs have deadlines on/before report date: ${closing.join(", ")}`);
}

for (const r of reports) {
  if (r.activeJobs !== (r.jobIds||[]).length) fail(`${r.date}: reports activeJobs != jobIds length.`);
  if ((r.freshJobIds||[]).some(id => !(r.jobIds||[]).includes(id))) fail(`${r.date}: freshJobIds outside jobIds.`);
  if (r.freshJobs !== (r.freshJobIds||[]).length) fail(`${r.date}: freshJobs != freshJobIds length.`);
  if ((r.previouslyListed||0)+(r.freshJobs||0)!==r.activeJobs) fail(`${r.date}: fresh + previouslyListed != activeJobs.`);
}

console.log(`Publication validation passed for latest date ${latest.date}. Active jobs: ${jobs.jobs.filter(j=>j.status==="active").length}.`);
