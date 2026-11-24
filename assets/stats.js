'use strict';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmtDate = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const text = (p) => fetch(`${p}?v=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(p))));
const jsonl = (t) => String(t || '').split(/\r?\n/).filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const link = (url, label) => (/^https?:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label));
const empty = (cols, msg) => `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`;

const RUN_LABEL = { MISSED: ['Missed', 'gap'], ARCHIVE_GAP: ['No archive', 'gap'], MANUAL_ARCHIVE: ['Manual archive', 'manual'], PARTIAL: ['Partial', 'manual'], PUBLISHED: ['Completed', 'published'], NORMAL: ['Completed', 'published'] };

function renderQueue(rows) {
  const q = rows.filter((l) => l.status === 'needs_review').sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen)) || (b.prescreen?.relevance || 0) - (a.prescreen?.relevance || 0));
  $('leadCount').textContent = `${q.length} lead${q.length === 1 ? '' : 's'}`;
  $('leadBody').innerHTML = q.slice(0, 200).map((l) => `<tr><td>${fmtDate(l.first_seen)}</td><td class="wrap title">${link(l.url, l.title)}</td><td class="wrap">${esc(l.company)}</td><td>${esc(l.location)}</td><td>${esc(l.source)}</td></tr>`).join('')
    || empty(5, 'The queue is empty. New leads appear here after each daily run.');
}

function renderUnique(rows) {
  const byKey = new Map();
  for (const v of rows) { const k = v.identity_key || v.id; if (k) byKey.set(k, v); }
  const list = [...byKey.values()].filter((v) => (v.match || 0) >= 75 && v.status !== 'excluded' && v.first_seen)
    .sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen)) || (b.match || 0) - (a.match || 0));
  $('uniqueCount').textContent = `${list.length} role${list.length === 1 ? '' : 's'}`;
  $('uniqueBody').innerHTML = list.map((v) => `<tr><td>${fmtDate(v.first_seen)}</td><td class="wrap title">${link(v.url, v.title || v.id)}</td><td class="wrap">${esc(v.company)}</td><td class="left">${esc(v.country)}</td><td>${esc(v.match)}%</td><td>${esc(v.status)}</td></tr>`).join('')
    || empty(6, 'No qualifying roles recorded yet.');
}

// Groups consecutive missed days into one row so real runs stay visible.
function groupRuns(entries) {
  const rows = [];
  for (const x of entries.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
    const prev = rows.at(-1);
    if (x.reportStatus === 'MISSED' && prev?.missed) { prev.from = x.date; prev.count++; continue; }
    rows.push(x.reportStatus === 'MISSED' ? { missed: true, from: x.date, to: x.date, count: 1 } : x);
  }
  return rows;
}

function renderDays(entries) {
  const num = (v) => (v === null || v === undefined ? '—' : esc(v));
  $('dayBody').innerHTML = groupRuns(entries).map((x) => {
    if (x.missed) {
      const range = x.count === 1 ? fmtDate(x.from) : `${fmtDate(x.from)} – ${fmtDate(x.to)}`;
      return `<tr class="missed"><td>${range}</td><td><span class="history-status gap">Missed</span></td><td>—</td><td>—</td><td>—</td><td class="wrap">${x.count === 1 ? 'No run on this day.' : `No run on ${x.count} consecutive days.`}</td></tr>`;
    }
    const [label, cls] = RUN_LABEL[x.reportStatus] || [x.reportStatus || '—', 'manual'];
    const note = String(x.notes || '');
    const short = note.length > 180 ? note.slice(0, 177) + '…' : note;
    return `<tr><td>${fmtDate(x.date)}</td><td><span class="history-status ${cls}">${esc(label)}</span></td><td>${num(x.activeJobs ?? x.activePublishedEquivalent)}</td><td>${num(x.freshJobs)}</td><td>${num(x.provisionalFindings)}</td><td class="wrap small" title="${esc(note)}">${esc(short)}</td></tr>`;
  }).join('') || empty(6, 'No runs recorded yet.');
}

async function load() {
  const [leads, state, history] = await Promise.allSettled([text('./state/leads.jsonl'), text('./state/vacancies.jsonl'), text('./data/daily-history.json')]);
  renderQueue(leads.status === 'fulfilled' ? jsonl(leads.value) : []);
  if (state.status === 'fulfilled') renderUnique(jsonl(state.value)); else $('uniqueBody').innerHTML = empty(6, 'Could not load vacancy history.');
  if (history.status === 'fulfilled') renderDays(JSON.parse(history.value).entries || []); else $('dayBody').innerHTML = empty(6, 'Could not load run history.');
}
load();
