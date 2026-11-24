'use strict';
const TRACKER_KEY = 'medtechJobTracker.v1';
const STATUSES = { new: 'New', wishlist: 'Wishlist', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer', rejected: 'Rejected' };
const CONNECTIONS = { none: 'None known', potential: 'Potential', known: 'Known', contacted: 'Contacted', referral: 'Referral' };
const MIN_SCORE = 75;

let jobs = [], report = null, queueSize = 0;
let roleType = 'jobs', view = 'jobs', country = 'all', minMatch = 0, deadlineWindow = 'all', sortMode = 'match';

const tracker = (() => { try { return JSON.parse(localStorage.getItem(TRACKER_KEY) || '{}') || {}; } catch (e) { return {}; } })();
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function fetchText(path) { const r = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(path); return r.text(); }
const fetchJson = async (path) => JSON.parse(await fetchText(path));

// Same key the tracker has always used, so saved tracker entries keep working.
const fingerprint = (j) => j.fingerprint || [j.company, j.title, j.location, j.country].map((v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).join('|');
const stateOf = (j) => tracker[fingerprint(j)] || { status: 'new', statusDate: '', notes: '', connection: 'none', followUpDate: '' };
function saveState(j, patch) { tracker[fingerprint(j)] = { ...stateOf(j), ...patch }; try { localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker)); } catch (e) {} }

const countryOf = (j) => j.country || 'Other Europe';
const isResearch = (j) => /\bph\.?d\b|doctoral|doctorate|doktorand/i.test(j.title || '') || (j.category || []).map((c) => String(c).toLowerCase()).includes('phd');
const deadlineDays = (j) => (j.deadline ? Math.ceil((new Date(j.deadline + 'T23:59:59') - new Date()) / 864e5) : null);
function deadlineLabel(j) { const d = deadlineDays(j); if (d === null) return 'No stated deadline'; if (d < 0) return 'Deadline passed'; if (d === 0) return 'Closes today'; if (d === 1) return 'Closes tomorrow'; return `Closes in ${d} days`; }

function published() {
  if (!report) return [];
  const ids = new Set(report.jobIds || []);
  return jobs.filter((j) => ids.has(j.id) && (j.match || 0) >= MIN_SCORE);
}
const ofRole = (list) => list.filter((j) => (roleType === 'research') === isResearch(j));

function filtered(list) {
  const out = list.filter((j) => (country === 'all' || countryOf(j) === country) && (j.match || 0) >= Math.max(MIN_SCORE, minMatch) &&
    (deadlineWindow === 'all' || ((d) => d !== null && d >= 0 && d <= Number(deadlineWindow))(deadlineDays(j))));
  const by = { match: (a, b) => b.match - a.match, deadline: (a, b) => (deadlineDays(a) ?? 1e4) - (deadlineDays(b) ?? 1e4), newest: (a, b) => Number(!!b.fresh) - Number(!!a.fresh) || b.match - a.match };
  return out.sort(by[sortMode]);
}

function render() {
  const all = published(), list = ofRole(all), shown = filtered(list);
  $('jobsCount').textContent = all.filter((j) => !isResearch(j)).length;
  $('researchCount').textContent = all.filter(isResearch).length;
  document.querySelectorAll('[data-role-type]').forEach((b) => b.classList.toggle('active', b.dataset.roleType === roleType));
  $('jobListHeading').textContent = roleType === 'jobs' ? 'Jobs for fresh graduates' : 'Research & PhD opportunities';
  $('jobListSubheading').textContent = `${shown.length} of ${list.length} shown`;

  $('stats').innerHTML = [
    [all.length, 'Published roles'], [all.filter((j) => j.fresh).length, 'Fresh today'],
    [all.filter((j) => j.match >= 90).length, '90%+ strong match'], [all.filter((j) => { const d = deadlineDays(j); return d !== null && d >= 0 && d <= 7; }).length, 'Closing within 7 days'],
  ].map(([n, l]) => `<div class="stat"><strong>${n}</strong><span>${l.toUpperCase()}</span></div>`).join('');

  const countries = [...new Set(all.map(countryOf))].sort();
  const cf = $('countryFilter');
  cf.innerHTML = '<option value="all">All countries</option>' + countries.map((c) => `<option>${esc(c)}</option>`).join('');
  cf.value = countries.includes(country) ? country : 'all';

  renderJobs(shown, list.length);
  renderTracker(all);
}

function renderJobs(out, total) {
  const el = $('jobs');
  if (!out.length) {
    const why = total ? 'No role matches the current filters.' : `No ${roleType === 'jobs' ? 'job' : 'research role'} passes every gate in the latest report.`;
    const queue = queueSize ? ` ${queueSize} unverified lead${queueSize === 1 ? '' : 's'} are waiting in the <a href="./stats.html#queue">review queue</a>.` : '';
    el.innerHTML = `<div class="empty"><b>${why}</b><br>The quality gates are not lowered to fill this list.${queue}</div>`;
    return;
  }
  el.innerHTML = out.map((j) => {
    const st = stateOf(j), d = deadlineDays(j), id = esc(fingerprint(j));
    const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('');
    return `<article class="job"><div class="head"><div><h2>${esc(j.title)}</h2><div class="company">${esc(j.company)}</div><div class="meta">${esc(j.location)}${(j.category || []).length ? ' · ' + j.category.map(esc).join(' · ') : ''}</div></div><div><div class="score">${j.match}%</div><div class="small">CV MATCH</div></div></div>
<div class="tags"><span class="tag ${j.fresh ? 'fresh' : 'old'}">${j.fresh ? 'FRESH' : 'Previously listed'}</span><span class="tag ${d !== null && d <= 7 ? 'deadline' : ''}">${esc(deadlineLabel(j))}</span>${st.status !== 'new' ? `<span class="tag">${STATUSES[st.status]}</span>` : ''}</div>
${(j.fit || []).length ? `<div class="why"><b>Why it fits</b><ul>${j.fit.map((x) => `<li>✓ ${esc(x)}</li>`).join('')}</ul></div>` : ''}${(j.gaps || []).length ? `<div class="small"><b>Gaps:</b> ${j.gaps.map(esc).join(' · ')}</div>` : ''}
<details><summary>Track this role</summary><div class="tracker-form"><label>Status<select data-action="status" data-id="${id}">${opt(STATUSES, st.status)}</select></label><label>Follow-up<input type="date" data-action="followUpDate" data-id="${id}" value="${esc(st.followUpDate)}"></label><label>Connection<select data-action="connection" data-id="${id}">${opt(CONNECTIONS, st.connection)}</select></label><label class="wide">Notes<textarea data-action="notes" data-id="${id}" placeholder="Recruiter, cover-letter angle, follow-up notes…">${esc(st.notes)}</textarea></label></div></details>
<p><a class="apply" href="${esc(j.url)}" target="_blank" rel="noopener">Apply / view listing →</a></p></article>`;
  }).join('');
}

function renderTracker(list) {
  const counts = Object.fromEntries(Object.keys(STATUSES).map((s) => [s, 0]));
  list.forEach((j) => counts[stateOf(j).status]++);
  $('pipeline').innerHTML = Object.keys(counts).map((s) => `<div class="pipe"><strong>${counts[s]}</strong><span>${STATUSES[s]}</span></div>`).join('');
  const tracked = list.filter((j) => { const s = stateOf(j); return s.status !== 'new' || s.notes || s.followUpDate || s.connection !== 'none'; });
  $('trackerList').innerHTML = tracked.length ? tracked.map((j) => { const s = stateOf(j); return `<div class="tracker-row"><div><b>${esc(j.match)}% · ${esc(j.title)}</b><div class="small">${esc(j.company)} · ${esc(countryOf(j))}</div></div><span class="tag">${STATUSES[s.status]}</span><span class="small">${s.followUpDate ? `Follow-up ${esc(s.followUpDate)}` : ''}</span></div>`; }).join('')
    : '<div class="empty">Nothing tracked yet. Use “Track this role” on a job.</div>';
}

function setView(v) {
  view = v;
  document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('active', x.dataset.view === v));
  document.querySelectorAll('.view-panel').forEach((x) => x.classList.toggle('hidden', x.id !== `view-${v}`));
}

function exportCsv() {
  const cols = ['Company', 'Role', 'Country', 'Location', 'Match', 'Deadline', 'Status', 'StatusDate', 'Connection', 'FollowUp', 'Notes', 'URL'];
  const rows = filtered(ofRole(published())).map((j) => { const s = stateOf(j); return [j.company, j.title, countryOf(j), j.location, j.match, j.deadline || '', STATUSES[s.status], s.statusDate, s.connection, s.followUpDate, s.notes, j.url]; });
  const csv = [cols, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `medtech-jobs-${report?.date || 'current'}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Countdown to the next 17:00 Europe/Berlin run.
function berlinOffsetMs(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - date.getTime();
}
function nextRun(now = new Date()) {
  for (let i = 0; i < 3; i++) {
    const day = new Date(now.getTime() + berlinOffsetMs(now) + i * 864e5);
    const pseudo = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 17);
    const t = new Date(pseudo - berlinOffsetMs(new Date(pseudo)));
    if (t > now) return t;
  }
}
function tick() {
  const diff = nextRun() - new Date(), pad = (n) => String(n).padStart(2, '0');
  $('countdown').textContent = `${pad(Math.floor(diff / 36e5))}:${pad(Math.floor((diff % 36e5) / 6e4))}:${pad(Math.floor((diff % 6e4) / 1e3))}`;
}

function renderFreshness() {
  const el = $('lastReport');
  if (!report) { el.textContent = 'No report yet'; return; }
  const age = Math.floor((Date.now() - new Date(report.date + 'T17:00:00')) / 864e5);
  el.textContent = `Last report: ${fmtDate(report.date)}${age > 1 ? ` · ${age} days old` : ''}`;
  el.classList.toggle('stale', age > 1);
}

document.addEventListener('change', (e) => {
  const a = e.target.dataset.action;
  if (a) {
    const j = jobs.find((x) => fingerprint(x) === e.target.dataset.id);
    if (j) { saveState(j, { [a]: e.target.value, ...(a === 'status' ? { statusDate: new Date().toISOString().slice(0, 10) } : {}) }); render(); }
    return;
  }
  const set = { countryFilter: (v) => (country = v), matchFilter: (v) => (minMatch = Number(v) || 0), deadlineFilter: (v) => (deadlineWindow = v), sortFilter: (v) => (sortMode = v) }[e.target.id];
  if (set) { set(e.target.value); render(); }
});
document.addEventListener('click', (e) => {
  const rt = e.target.closest('[data-role-type]');
  if (rt) { roleType = rt.dataset.roleType; render(); return; }
  const v = e.target.closest('[data-view]');
  if (v) setView(v.dataset.view);
});
$('exportCsv').addEventListener('click', exportCsv);

async function load() {
  try {
    const [r, j] = await Promise.all([fetchJson('./data/reports.json'), fetchJson('./data/jobs.json')]);
    report = (r.reports || []).slice().sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null;
    jobs = j.jobs || [];
  } catch (e) {
    $('jobs').innerHTML = '<div class="empty">The job data could not be loaded. Please refresh.</div>';
    return;
  }
  try {
    queueSize = (await fetchText('./state/leads.jsonl')).split(/\r?\n/).filter((l) => l.includes('"needs_review"')).length;
  } catch (e) { queueSize = 0; }
  renderFreshness();
  render();
}

setView('jobs');
tick();
setInterval(tick, 1000);
load();
