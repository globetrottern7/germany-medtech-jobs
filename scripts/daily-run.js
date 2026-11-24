#!/usr/bin/env node
'use strict';
/*
 * Automated daily run.
 *
 *   node scripts/daily-run.js [--date YYYY-MM-DD] [--offline] [--dry-run] [--force] [--scheduled]
 *
 * 1. Records missed runs for dates with no report (no counts are synthesised).
 * 2. Maintenance: expires past-deadline roles, link-checks active/provisional official URLs.
 * 3. Discovery: queries the public job APIs configured in state/automation.json.
 * 4. Pre-screen: deterministic reject/lead decision; leads go to state/leads.jsonl.
 * 5. Optional adjudication (off by default) with all hard gates enforced in code.
 * 6. Writes data/daily/<date>.json, data/reports.json, data/daily-history.json,
 *    data/research-status.json and the state/ registry, in the formats the validator expects.
 */
const io = require('./lib/io');
const { identityKey, matchKey, slug } = require('./lib/identity');
const { ADAPTERS, http } = require('./lib/sources');
const { prescreen } = require('./lib/prescreen');
const { adjudicateWithOpenAI, decide } = require('./lib/adjudicate');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const OFFLINE = flag('offline');
const DRY = flag('dry-run');
const FORCE = flag('force');
const SCHEDULED = flag('scheduled');

const STATUS_ORDER = ['official_page_checked', 'indexed_search_attempted', 'unavailable_or_blocked', 'not_searched'];
const log = (...m) => console.log('[daily-run]', ...m);

function berlinNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(new Date()).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}
const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const isResearch = (j) => /\bph\.?d\b|doctoral|doctorate|doktorand|promotion/i.test(j.title || '') || (j.category || []).map((c) => String(c).toLowerCase()).includes('phd');

async function main() {
  const now = berlinNow();
  const today = opt('date') || now.date;
  const automation = io.readJson('state/automation.json');

  if (SCHEDULED && !opt('date') && now.hour < (automation.schedule?.earliestHour ?? 17)) {
    log(`Scheduled trigger at Berlin hour ${now.hour}; waiting for the ${automation.schedule.earliestHour}:00 run.`);
    return;
  }
  if (io.exists(`data/daily/${today}.json`) && !FORCE) {
    log(`Report for ${today} already exists; nothing to do (use --force to rebuild).`);
    return;
  }

  // ---------------------------------------------------------------- load
  const jobsDoc = io.readJson('data/jobs.json');
  const jobs = jobsDoc.jobs;
  const reportsDoc = io.readJson('data/reports.json');
  const historyDoc = io.readJson('data/daily-history.json');
  const config = io.readJson('state/config.json');
  const profile = io.readJson('data/candidate-profile.json');
  const minScore = config.publication?.minScore ?? 75;
  const windowHours = config.verificationWindowHours ?? 72;

  let vacancies = io.readJsonl('state/vacancies.jsonl');
  const fingerprints = io.readCsv('state/fingerprints.csv');
  const leads = io.readJsonl('state/leads.jsonl');
  const exclusionsOut = [];
  const changes = [];

  // De-duplicate the vacancy registry (one entity per identity_key; prefer the record whose
  // status matches jobs.json, otherwise the most recent line).
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  {
    const byKey = new Map();
    for (const v of vacancies) {
      const prev = byKey.get(v.identity_key);
      const agrees = jobById.get(v.id)?.status === v.status;
      if (!prev || agrees || jobById.get(prev.id)?.status !== prev.status) byKey.set(v.identity_key, v);
    }
    if (byKey.size !== vacancies.length) changes.push(`Collapsed ${vacancies.length - byKey.size} duplicate vacancy registry record(s).`);
    vacancies = [...byKey.values()];
  }
  const vacById = new Map(vacancies.map((v) => [v.id, v]));

  // ---------------------------------------------------------------- missed runs
  const history = historyDoc.entries;
  const missed = [];
  if (automation.recordMissedRuns && history.length) {
    const have = new Set(history.map((e) => e.date));
    const first = history.map((e) => e.date).sort()[0];
    for (let d = first; d < today; d = addDays(d, 1)) {
      if (!have.has(d)) {
        missed.push(d);
        history.push({
          date: d, reportStatus: 'MISSED', reportType: 'missed run — no research executed',
          activeJobs: null, freshJobs: null, previouslyListed: null, closingWithin7Days: null, newGatePassing: null, provisionalFindings: null,
          sourceCoverageGrade: 'MISSED',
          notes: 'No daily run was recorded for this date. Entry added by the automated pipeline so the gap is explicit; no counts are synthesised.',
        });
      }
    }
    history.sort((a, b) => a.date.localeCompare(b.date));
    if (missed.length) changes.push(`Recorded ${missed.length} missed run date(s): ${missed[0]} … ${missed.at(-1)}.`);
  }

  // ---------------------------------------------------------------- maintenance
  const transitioned = [];
  const setStatus = (j, status, reason, extra = {}) => {
    const from = j.status;
    Object.assign(j, { status, ...extra });
    if (status === 'expired') j.expiredDate = today;
    if (status === 'closed') j.closedDate = today;
    j.statusReason = reason;
    const v = vacById.get(j.id);
    if (v) Object.assign(v, { status, last_attempted: today, exclusion_reason: reason });
    transitioned.push(j.id);
    exclusionsOut.push({ id: j.id, identity_key: identityKey(j), from, status, reason, date: today, automated: true });
    changes.push(`${j.id}: ${from} → ${status} (${reason}).`);
  };

  for (const j of jobs) {
    if (!['active', 'provisional'].includes(j.status)) continue;
    if (j.deadline && j.deadline < today) setStatus(j, 'expired', `Deadline ${j.deadline} passed`);
  }

  const linkResults = [];
  if (!OFFLINE && automation.linkCheck?.enabled) {
    const patterns = (automation.linkCheck.closedTextPatterns || []).map((s) => s.toLowerCase());
    for (const j of jobs) {
      if (!automation.linkCheck.statuses.includes(j.status) || !/^https?:\/\//.test(j.url || '')) continue;
      try {
        const html = (await http(j.url, { as: 'text', timeoutMs: 20000 })).toLowerCase();
        const hit = patterns.find((p) => html.includes(p));
        if (hit) {
          setStatus(j, 'closed', `Official page states "${hit}"`);
          linkResults.push({ id: j.id, result: 'closed_text' });
        } else {
          j.lastLinkCheck = { date: today, result: 'reachable' };
          // A reachable official page re-verifies open status of an already gate-passed (active) role.
          if (j.status === 'active') { j.lastVerified = today; j.lastVerifiedMethod = 'automated-official-page-check'; }
          linkResults.push({ id: j.id, result: 'reachable' });
        }
      } catch (e) {
        if ((automation.linkCheck.closedStatusCodes || []).includes(e.status)) {
          setStatus(j, 'closed', `Official URL returned HTTP ${e.status}`);
          linkResults.push({ id: j.id, result: `http_${e.status}` });
        } else {
          j.lastLinkCheck = { date: today, result: 'error', error: String(e.message).slice(0, 200) };
          linkResults.push({ id: j.id, result: 'error', error: String(e.message).slice(0, 200) });
        }
      }
    }
  }

  // Active roles outside the verification window cannot be published; downgrade explicitly.
  for (const j of jobs) {
    if (j.status !== 'active') continue;
    const v = j.lastVerified || j.last_verified;
    if (!v || daysBetween(v.slice(0, 10), today) * 24 > windowHours) {
      setStatus(j, 'provisional', `Official verification older than ${windowHours}h (last ${v || 'never'})`);
    }
  }

  // ---------------------------------------------------------------- discovery
  const ledgerAuto = [];
  const discovered = [];
  const sourceJobs = [];
  const s = automation.sources || {};
  if (s.bundesagentur?.enabled) sourceJobs.push({ name: s.bundesagentur.ledgerName, adapter: 'bundesagentur', opts: s.bundesagentur, status: 'official_page_checked', method: 'public_api' });
  if (s.arbeitnow?.enabled) sourceJobs.push({ name: s.arbeitnow.ledgerName, adapter: 'arbeitnow', opts: s.arbeitnow, status: 'indexed_search_attempted', method: 'public_api_aggregator' });
  for (const a of s.ats || []) sourceJobs.push({ name: `${a.adapter}: ${a.company}`, adapter: a.adapter, opts: a, status: 'official_page_checked', method: 'employer_ats_api' });

  for (const sj of sourceJobs) {
    const entry = { source: sj.name, sourceGroups: ['automatedDiscovery'], status: 'not_searched', method: null, query: null, indexedResultsSurfaced: 0, leadsSurfaced: [], officialVerificationOutcome: '', evidenceUrls: [], notes: '' };
    if (OFFLINE) { entry.notes = 'Offline run: not executed.'; ledgerAuto.push(entry); continue; }
    try {
      const { leads: found, attempts } = await ADAPTERS[sj.adapter](sj.opts);
      Object.assign(entry, {
        status: sj.status, method: sj.method, query: attempts.map((a) => `${a.query} (${a.results})`).join('; '),
        indexedResultsSurfaced: found.length, lastAttempted: today,
        officialVerificationOutcome: sj.status === 'official_page_checked' ? 'Official source queried via public API; leads still require gate adjudication.' : 'Aggregator discovery only; leads require official-source verification.',
      });
      discovered.push(...found);
    } catch (e) {
      Object.assign(entry, { status: 'unavailable_or_blocked', method: sj.method, query: sj.adapter, lastAttempted: today, blocker: String(e.message).slice(0, 300), officialVerificationOutcome: 'Attempt failed; no absence claim.' });
    }
    ledgerAuto.push(entry);
  }

  // Dedupe within the run, then against the registry.
  const known = new Map();
  for (const v of vacancies) known.set(matchKey(v), v);
  for (const j of jobs) known.set(matchKey(j), j);
  const leadByKey = new Map(leads.map((l) => [l.match_key, l]));
  const seenRun = new Set();
  const rejectedByReason = {};
  const newLeadIds = [];
  let knownMatches = 0;

  for (const d of discovered) {
    const mk = matchKey(d);
    if (seenRun.has(mk)) continue;
    seenRun.add(mk);
    if (known.has(mk)) {
      knownMatches++;
      const fp = fingerprints.find((f) => f.identity_key === known.get(mk).identity_key || f.identity_key === identityKey(known.get(mk)));
      if (fp) fp.last_seen = today;
      continue;
    }
    const existing = leadByKey.get(mk);
    if (existing) { existing.last_seen = today; existing.url = d.url || existing.url; continue; }
    const ps = prescreen(d, { config, profile });
    if (ps.decision === 'reject') {
      const r = ps.reasons[0];
      rejectedByReason[r] = (rejectedByReason[r] || 0) + 1;
      continue;
    }
    const lead = {
      lead_id: `${slug(d.company, 30)}-${slug(d.title, 40)}-${today}`,
      match_key: mk, identity_key: identityKey(d),
      title: d.title, company: d.company, location: d.location, country: d.country,
      url: d.officialUrl || d.url, listingUrl: d.url, source: d.source, sourceType: d.sourceType, verificationTier: d.verificationTier,
      externalId: d.externalId, postedAt: d.postedAt, coordinates: d.coordinates || null,
      first_seen: today, last_seen: today, status: 'needs_review',
      prescreen: { relevance: ps.relevance, notes: ps.reasons, signals: { domain: ps.signals.domainHits, function: ps.signals.functionHits, graduate: ps.signals.graduateHits } },
      description: (d.description || '').slice(0, 4000),
    };
    leads.push(lead);
    leadByKey.set(mk, lead);
    newLeadIds.push(lead.lead_id);
  }

  // ---------------------------------------------------------------- optional adjudication
  const adjudicated = [];
  const adj = automation.adjudication || {};
  if (!OFFLINE && adj.enabled && process.env.OPENAI_API_KEY) {
    const queue = leads.filter((l) => l.status === 'needs_review').sort((a, b) => b.prescreen.relevance - a.prescreen.relevance).slice(0, adj.maxLeadsPerRun || 10);
    for (const lead of queue) {
      try {
        const r = await adjudicateWithOpenAI(lead, { profile, config, settings: adj });
        if (r.status !== 'ok') { lead.status = 'needs_review'; lead.adjudicationNote = r.reason; continue; }
        const dec = decide(lead, r.result, { profile, minScore, duplicate: known.has(lead.match_key) });
        lead.status = `adjudicated_${dec.outcome}`;
        lead.adjudication = { date: today, model: r.model, ...dec, evidence: r.result.gates };
        adjudicated.push({ lead_id: lead.lead_id, outcome: dec.outcome, match: dec.match });
        if (dec.outcome === 'exclude') { exclusionsOut.push({ id: lead.lead_id, identity_key: lead.identity_key, status: 'excluded', reason: dec.reasons.join('; '), date: today, automated: true }); continue; }
        const job = {
          id: lead.lead_id, title: lead.title, company: lead.company, location: lead.location, country: lead.country,
          category: r.result.category, match: dec.match, fresh: false, status: dec.outcome === 'publish' ? 'active' : 'provisional',
          deadline: /^\d{4}-\d{2}-\d{2}$/.test(r.result.deadline || '') ? r.result.deadline : null,
          url: lead.url, sourceType: lead.sourceType, sourceLayers: [lead.source], openVerified: today, lastVerified: today,
          lastVerifiedMethod: 'automated-adjudication', fit: r.result.fit, gaps: r.result.gaps, scoreBreakdown: dec.scoreBreakdown,
          experienceRequirement: r.result.experienceRequirement, languageRequirement: r.result.languageRequirement,
          gates: dec.gates, statusReason: dec.reasons.join('; ') || null, coordinates: lead.coordinates,
          sponsorship: { offered: 'unclear' }, relocation: { offered: 'unclear' }, fingerprint: lead.identity_key, automated: true,
        };
        jobs.push(job);
        jobById.set(job.id, job);
        const vac = { identity_key: lead.identity_key, id: job.id, title: job.title, company: job.company, location: job.location, country: job.country, status: job.status, first_seen: today, last_verified: today, url: job.url, match: job.match, fresh: false, category: job.category, deadline: job.deadline, sourceType: job.sourceType, gate_state: dec.outcome === 'publish' ? 'PASS' : 'PROVISIONAL', classification: 'NEW' };
        vacancies.push(vac);
        vacById.set(job.id, vac);
        fingerprints.push({ identity_key: lead.identity_key, company: job.company, title: job.title, location: job.location, country: job.country, first_seen: today, last_seen: today, status: job.status, repost_count: '0' });
        known.set(lead.match_key, job);
      } catch (e) {
        lead.adjudicationNote = `Adjudication error: ${String(e.message).slice(0, 200)}`;
      }
    }
  }

  // ---------------------------------------------------------------- build report
  const reports = reportsDoc.reports;
  const priorReports = reports.filter((r) => r.date < today);
  const priorIdentities = new Set();
  for (const r of priorReports) for (const id of r.jobIds || []) { const j = jobById.get(id); if (j) priorIdentities.add(matchKey(j)); }

  const published = jobs.filter((j) => j.status === 'active' && (j.match || 0) >= minScore && /^https?:\/\//.test(j.url || '') && (!j.deadline || j.deadline >= today));
  for (const j of published) j.fresh = !priorIdentities.has(matchKey(j));
  const jobIds = published.map((j) => j.id);
  const freshJobIds = published.filter((j) => j.fresh).map((j) => j.id);
  const closingDays = (j) => (j.deadline ? daysBetween(today, j.deadline) : null);
  const closing = (list) => list.filter((j) => { const d = closingDays(j); return d !== null && d >= 0 && d <= 7; }).length;
  const provisional = jobs.filter((j) => j.status === 'provisional');

  // Source ledger: previous ledger entries reset to not_searched, plus today's automated entries.
  const prevDaily = [...reports].reverse().map((r) => r.date).filter((d) => d < today).map((d) => `data/daily/${d}.json`).find((p) => io.exists(p) && io.readJson(p).sourceCoverage?.sourceExecutionLedger);
  const prevLedger = prevDaily ? io.readJson(prevDaily).sourceCoverage.sourceExecutionLedger : [];
  const autoNames = new Set(ledgerAuto.map((e) => e.source.toLowerCase()));
  const ledger = [
    ...prevLedger.filter((e) => !autoNames.has(String(e.source).toLowerCase())).map((e) => ({
      source: e.source, sourceGroups: e.sourceGroups || [], status: 'not_searched', method: null, query: null,
      indexedResultsSurfaced: 0, leadsSurfaced: [], officialVerificationOutcome: `Not searched by the automated ${today} run; no absence claim.`, evidenceUrls: [],
      notes: 'Source has no public API reachable by the automated pipeline; requires manual or browser-based research.',
    })),
    ...ledgerAuto,
  ];
  for (const w of config.weeklySourceBaseline || []) {
    if (!ledger.some((e) => String(e.source).toLowerCase() === w.toLowerCase())) ledger.push({ source: w, sourceGroups: ['weeklySourceBaseline'], status: 'not_searched', method: null, query: null, indexedResultsSurfaced: 0, leadsSurfaced: [], officialVerificationOutcome: 'Not searched; no absence claim.', evidenceUrls: [], notes: '' });
  }
  const statusCounts = Object.fromEntries(STATUS_ORDER.map((k) => [k, ledger.filter((e) => e.status === k).length]));
  const executed = ledger.length - statusCounts.not_searched;

  const queueSize = leads.filter((l) => l.status === 'needs_review').length;
  const notes = [
    `Automated run ${today}.`,
    `${jobIds.length} role(s) passed every publication gate (${freshJobIds.length} fresh).`,
    `${discovered.length} listing(s) retrieved from ${ledgerAuto.filter((e) => e.status !== 'not_searched' && e.status !== 'unavailable_or_blocked').length} automated source(s); ${newLeadIds.length} new lead(s) queued for adjudication, ${knownMatches} matched known vacancies.`,
    adj.enabled ? `${adjudicated.length} lead(s) adjudicated.` : `Adjudication is disabled; ${queueSize} lead(s) await review in state/leads.jsonl.`,
    transitioned.length ? `${transitioned.length} status transition(s): ${[...new Set(transitioned)].join(', ')}.` : 'No status transitions.',
    missed.length ? `${missed.length} missed run date(s) recorded explicitly.` : '',
    'Coverage is PARTIAL: only sources with public APIs were executed. No new vacancy passed the gates in the sources searched does not imply market absence.',
  ].filter(Boolean).join(' ');

  const base = {
    date: today,
    reportType: 'normal daily automated refresh',
    reportStatus: 'PARTIAL_AUTOMATED_COVERAGE',
    productionProtocol: config.version,
    activeJobs: jobIds.length,
    freshJobs: freshJobIds.length,
    previouslyListed: jobIds.length - freshJobIds.length,
    closingWithin7Days: closing(published) + closing(provisional),
    closingWithin7DaysPublished: closing(published),
    closingWithin7DaysProvisional: closing(provisional),
    newGatePassing: adjudicated.filter((a) => a.outcome === 'publish').length,
    provisionalFindings: provisional.length,
    provisionalFindingIds: provisional.map((j) => j.id),
    jobIds, freshJobIds,
    excludedJobIds: [...new Set(transitioned)].filter((id) => ['expired', 'closed', 'excluded'].includes(jobById.get(id)?.status)),
    typicalEmploymentJobs: published.filter((j) => !isResearch(j)).length,
    researchPhdJobs: published.filter(isResearch).length,
    defaultView: 'Typical jobs',
    notes,
  };
  const daily = {
    ...base,
    sourceCoverage: {
      grade: 'PARTIAL', coverageStatus: 'PARTIAL', ledgerVersion: config.version, coverageDate: today, runTimestamp: new Date().toISOString(),
      fullCoverageClaim: false, queryRecordsSubmitted: ledgerAuto.reduce((n, e) => n + (e.query ? e.query.split('; ').length : 0), 0),
      configuredSourceCount: ledger.length, executedSourceCount: executed, notSearchedCount: statusCounts.not_searched, statusCounts,
      coverageStatement: 'Automated partial execution. Only sources exposing a public API were queried; every other configured source is explicitly not_searched. No exhaustive search claim is made.',
      sourceExecutionLedger: ledger,
    },
    automatedDiscovery: {
      listingsRetrieved: discovered.length, uniqueListings: seenRun.size, knownVacancyMatches: knownMatches,
      newLeadIds, reviewQueueSize: queueSize, prescreenRejectionsByReason: rejectedByReason, adjudicated, linkChecks: linkResults,
    },
    maintenance: { missedRunDates: missed, statusTransitions: exclusionsOut.filter((x) => x.from), changes },
    sourcesSearched: ledgerAuto.filter((e) => e.status !== 'not_searched').map((e) => e.source),
  };
  const reportIndex = {
    ...base,
    sourceCoverage: { grade: 'PARTIAL', sourceExecutionLedgerEntries: ledger.length, statusCounts, sourceExecutionLedgerPath: `data/daily/${today}.json#sourceCoverage.sourceExecutionLedger` },
  };
  const histEntry = {
    date: today, reportStatus: 'PARTIAL', reportType: base.reportType,
    activeJobs: base.activeJobs, activePublishedEquivalent: base.activeJobs, freshJobs: base.freshJobs, previouslyListed: base.previouslyListed,
    closingWithin7Days: base.closingWithin7Days, newGatePassing: base.newGatePassing, provisionalFindings: base.provisionalFindings,
    automatedLeadsQueued: newLeadIds.length, notes,
    sourceCoverageGrade: 'PARTIAL', sourceExecutionLedgerEntries: ledger.length, sourceExecutionLedgerStatusCounts: statusCounts,
    sourceExecutionLedgerPath: reportIndex.sourceCoverage.sourceExecutionLedgerPath,
  };

  const ri = reports.findIndex((r) => r.date === today);
  if (ri >= 0) reports[ri] = reportIndex; else reports.push(reportIndex);
  reports.sort((a, b) => a.date.localeCompare(b.date));
  const hi = history.findIndex((e) => e.date === today);
  if (hi >= 0) history[hi] = histEntry; else history.push(histEntry);
  historyDoc.generated = new Date().toISOString();

  const prevStatus = io.readJson('data/research-status.json', {});
  const status = {
    ...prevStatus,
    status: 'automated-partial-run-recorded',
    message: notes,
    updatedAt: today, reportDate: today,
    activeJobs: base.activeJobs, freshJobs: base.freshJobs, previouslyListed: base.previouslyListed,
    publicationThreshold: minScore, strongMatchThreshold: config.publication?.strongMatch ?? 90,
    automation: { pipeline: 'scripts/daily-run.js', config: 'state/automation.json', reviewQueue: 'state/leads.jsonl', reviewQueueSize: queueSize, adjudicationEnabled: !!adj.enabled, lastRun: new Date().toISOString() },
    sourceCoverage: { ...daily.sourceCoverage, sourceExecutionLedger: undefined, ledgerPath: reportIndex.sourceCoverage.sourceExecutionLedgerPath },
  };

  // Sync registry statuses.
  for (const f of fingerprints) {
    const v = vacancies.find((x) => x.identity_key === f.identity_key);
    if (v) f.status = v.status;
  }
  for (const j of jobs) { const v = vacById.get(j.id); if (v && v.status !== j.status) v.status = j.status; }

  log(notes);
  if (DRY) { log('Dry run: no files written.'); return; }
  io.writeJson(`data/daily/${today}.json`, daily);
  io.writeJson('data/reports.json', reportsDoc);
  io.writeJson('data/daily-history.json', historyDoc);
  io.writeJson('data/research-status.json', status);
  jobsDoc.lastUpdated = today;
  io.writeJson('data/jobs.json', jobsDoc);
  io.writeJsonl('state/vacancies.jsonl', vacancies);
  io.writeJsonl('state/leads.jsonl', leads);
  io.appendJsonl('state/exclusions.jsonl', exclusionsOut);
  io.writeCsv('state/fingerprints.csv', fingerprints, ['identity_key', 'company', 'title', 'location', 'country', 'first_seen', 'last_seen', 'status', 'repost_count']);

  if (process.env.GITHUB_STEP_SUMMARY) {
    require('fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      `## Daily run ${today}`, '', notes, '',
      '| Source | Status | Results |', '|---|---|---:|',
      ...ledgerAuto.map((e) => `| ${e.source} | ${e.status}${e.blocker ? ` — ${e.blocker}` : ''} | ${e.indexedResultsSurfaced} |`),
      '', `New leads: ${newLeadIds.length} · Review queue: ${queueSize}`, '',
    ].join('\n'));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
