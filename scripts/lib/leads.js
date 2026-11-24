'use strict';
// Review-queue helpers: duplicate detection when a listing has no usable city.
//
// matchKey() includes the primary city, so the same vacancy seen once with a city and once
// without one (or with only a country, e.g. an older "Germany" default) would otherwise be
// queued twice. A lead without a city is treated as the same vacancy as a queued lead with the
// same normalised company and title.

const { normCompany, normTitle, normCity, fold } = require('./identity');

const COUNTRY_WORDS = new Set(['germany', 'deutschland', 'austria', 'osterreich', 'switzerland', 'schweiz', 'netherlands', 'nederland', 'ireland', 'france', 'belgium', 'denmark', 'sweden', 'spain', 'italy', 'poland', 'united kingdom', 'europe', 'remote', 'hybrid', 'anywhere']);

const looseKey = (v) => `${normCompany(v.company)}|${normTitle(v.title)}`;

function cityless(v) {
  const city = normCity(v.location);
  return !city || COUNTRY_WORDS.has(city) || city === fold(v.country).replace(/[^a-z ]+/g, '').trim();
}

// Prefer the record with a real city; otherwise the most recently seen one.
function better(a, b) {
  if (cityless(a) !== cityless(b)) return cityless(a) ? b : a;
  return String(b.last_seen || '') > String(a.last_seen || '') ? b : a;
}

// Marks queued duplicates as status 'duplicate' (kept for audit). Returns the number collapsed.
function collapseDuplicates(leads, today) {
  const groups = new Map();
  for (const l of leads) {
    if (l.status !== 'needs_review') continue;
    const k = looseKey(l);
    (groups.get(k) || groups.set(k, []).get(k)).push(l);
  }
  let collapsed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const withCity = group.filter((l) => !cityless(l));
    // Two different real cities are different vacancies; only collapse cityless entries.
    const cities = new Set(withCity.map((l) => normCity(l.location)));
    if (cities.size > 1 && withCity.length === group.length) continue;
    const keep = group.reduce(better);
    for (const l of group) {
      if (l === keep || (!cityless(l) && cities.size > 1)) continue;
      l.status = 'duplicate';
      l.duplicateOf = keep.lead_id;
      l.duplicateDate = today;
      keep.first_seen = [keep.first_seen, l.first_seen].filter(Boolean).sort()[0];
      collapsed++;
    }
  }
  return collapsed;
}

// Finds a queued lead that is the same vacancy as discovery `d` when either side lacks a city.
function findCitylessMatch(leads, d) {
  const k = looseKey(d);
  return leads.find((l) => l.status === 'needs_review' && looseKey(l) === k && (cityless(l) || cityless(d))) || null;
}

function uniqueLeadId(base, leads) {
  const ids = new Set(leads.map((l) => l.lead_id));
  if (!ids.has(base)) return base;
  for (let i = 2; ; i++) if (!ids.has(`${base}-${i}`)) return `${base}-${i}`;
}

module.exports = { looseKey, cityless, collapseDuplicates, findCitylessMatch, uniqueLeadId };
