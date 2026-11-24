'use strict';
// Public, documented job-data endpoints. Each adapter returns normalised leads:
// { source, sourceType, verificationTier, externalId, title, company, location, country,
//   url, postedAt, description, coordinates }
// No scraping of sites that do not expose a public endpoint, no login, no bypassing of blocks.

const UA = 'medtech-jobs-research-bot/1.0 (+GitHub Actions; public job APIs only)';

async function http(url, { method = 'GET', headers = {}, body, timeoutMs = 20000, as = 'json' } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method, body, signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : '*/*', ...headers },
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} for ${url}`);
      err.status = res.status;
      throw err;
    }
    return as === 'json' ? res.json() : res.text();
  } finally {
    clearTimeout(t);
  }
}

const COUNTRY_BY_CODE = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland', NL: 'Netherlands', IE: 'Ireland', BE: 'Belgium', FR: 'France', DK: 'Denmark', SE: 'Sweden', ES: 'Spain', IT: 'Italy', PL: 'Poland', CZ: 'Czechia', FI: 'Finland', NO: 'Norway', PT: 'Portugal', LU: 'Luxembourg', GB: 'United Kingdom', UK: 'United Kingdom' };
const COUNTRY_NAMES = Object.values(COUNTRY_BY_CODE).concat(['Deutschland', 'Österreich', 'Schweiz']);
const ALIAS = { Deutschland: 'Germany', 'Österreich': 'Austria', Schweiz: 'Switzerland' };

function countryFrom(text, fallback = '') {
  const s = String(text || '');
  for (const n of COUNTRY_NAMES) if (s.includes(n)) return ALIAS[n] || n;
  const code = s.match(/\b([A-Z]{2})\b\s*$/);
  if (code && COUNTRY_BY_CODE[code[1]]) return COUNTRY_BY_CODE[code[1]];
  return fallback;
}

const stripHtml = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Bundesagentur für Arbeit — Jobsuche API (public client key documented at
// https://jobsuche.api.bund.dev/). Official public-employment source (tier 3).
async function bundesagentur({ queries = [], publishedSinceDays = 7, pageSize = 50, maxPages = 2, wo, umkreis }) {
  const base = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs';
  const out = [];
  const attempts = [];
  for (const was of queries) {
    let count = 0;
    for (let page = 1; page <= maxPages; page++) {
      const qs = new URLSearchParams({ was, angebotsart: '1', veroeffentlichtseit: String(publishedSinceDays), size: String(pageSize), page: String(page) });
      if (wo) qs.set('wo', wo);
      if (umkreis) qs.set('umkreis', String(umkreis));
      const data = await http(`${base}?${qs}`, { headers: { 'X-API-Key': 'jobboerse-jobsuche' } });
      const items = parseBundesagentur(data);
      out.push(...items);
      count += items.length;
      if (items.length < pageSize) break;
    }
    attempts.push({ query: was, results: count });
  }
  return { leads: out, attempts };
}

function parseBundesagentur(data) {
  return (data?.stellenangebote || []).map((s) => {
    const ort = s.arbeitsort || {};
    const country = ALIAS[ort.land] || ort.land || 'Germany';
    return {
      source: 'Bundesagentur für Arbeit',
      sourceType: 'public-employment',
      verificationTier: 3,
      externalId: s.refnr,
      title: s.titel || s.beruf,
      company: s.arbeitgeber,
      location: [ort.ort, country].filter(Boolean).join(', '),
      country,
      url: s.externeUrl || `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(s.refnr)}`,
      officialUrl: `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(s.refnr)}`,
      postedAt: s.aktuelleVeroeffentlichungsdatum || null,
      description: s.beruf || '',
      coordinates: ort.koordinaten ? [ort.koordinaten.lat, ort.koordinaten.lon] : null,
    };
  }).filter((l) => l.externalId && l.title && l.company);
}

// ---------------------------------------------------------------------------
// Arbeitnow — free public job-board API (aggregator; discovery only, tier 5).
async function arbeitnow({ maxPages = 3 }) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await http(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    const items = parseArbeitnow(data);
    out.push(...items);
    if (!data?.links?.next) break;
  }
  return { leads: out, attempts: [{ query: `job-board-api pages 1-${maxPages}`, results: out.length }] };
}

function parseArbeitnow(data) {
  return (data?.data || []).map((j) => ({
    source: 'Arbeitnow',
    sourceType: 'aggregator',
    verificationTier: 5,
    externalId: j.slug,
    title: j.title,
    company: j.company_name,
    location: j.location ? `${j.location}${countryFrom(j.location) ? '' : ', Germany'}` : 'Germany',
    country: countryFrom(j.location, 'Germany'),
    url: j.url,
    postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString().slice(0, 10) : null,
    description: stripHtml(j.description).slice(0, 6000),
    remote: !!j.remote,
  })).filter((l) => l.externalId && l.title);
}

// ---------------------------------------------------------------------------
// Employer ATS adapters (tier 1 — official employer sources).
async function greenhouse({ board, company }) {
  const data = await http(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`);
  return { leads: parseGreenhouse(data, company), attempts: [{ query: `greenhouse:${board}`, results: (data.jobs || []).length }] };
}
function parseGreenhouse(data, company) {
  return (data?.jobs || []).map((j) => ({
    source: `Greenhouse (${company})`, sourceType: 'employer-ats', verificationTier: 1,
    externalId: String(j.id), title: j.title, company,
    location: j.location?.name || '', country: countryFrom(j.location?.name),
    url: j.absolute_url, postedAt: (j.updated_at || '').slice(0, 10) || null,
    description: stripHtml(decodeEntities(j.content)).slice(0, 6000),
  }));
}
const decodeEntities = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

async function lever({ site, company }) {
  const data = await http(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`);
  return { leads: parseLever(data, company), attempts: [{ query: `lever:${site}`, results: (data || []).length }] };
}
function parseLever(data, company) {
  return (Array.isArray(data) ? data : []).map((j) => ({
    source: `Lever (${company})`, sourceType: 'employer-ats', verificationTier: 1,
    externalId: j.id, title: j.text, company,
    location: j.categories?.location || '', country: countryFrom(j.categories?.location || j.country) || COUNTRY_BY_CODE[j.country] || '',
    url: j.hostedUrl, postedAt: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : null,
    description: String(j.descriptionPlain || stripHtml(j.description)).slice(0, 6000),
  }));
}

async function smartrecruiters({ companyId, company, country }) {
  const qs = new URLSearchParams({ limit: '100' });
  if (country) qs.set('country', country);
  const data = await http(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyId)}/postings?${qs}`);
  return { leads: parseSmartRecruiters(data, company, companyId), attempts: [{ query: `smartrecruiters:${companyId}`, results: (data.content || []).length }] };
}
function parseSmartRecruiters(data, company, companyId) {
  return (data?.content || []).map((j) => {
    const country = COUNTRY_BY_CODE[String(j.location?.country || '').toUpperCase()] || '';
    return {
      source: `SmartRecruiters (${company})`, sourceType: 'employer-ats', verificationTier: 1,
      externalId: j.id, title: j.name, company,
      location: [j.location?.city, country].filter(Boolean).join(', '), country,
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(companyId)}/${encodeURIComponent(j.id)}`,
      postedAt: (j.releasedDate || '').slice(0, 10) || null,
      description: [j.experienceLevel?.label, j.function?.label, j.department?.label].filter(Boolean).join(' · '),
      experienceLevel: j.experienceLevel?.id || null,
    };
  });
}

async function personio({ subdomain, company }) {
  const xml = await http(`https://${encodeURIComponent(subdomain)}.jobs.personio.de/xml?language=de`, { as: 'text' });
  const leads = parsePersonio(xml, company, subdomain);
  return { leads, attempts: [{ query: `personio:${subdomain}`, results: leads.length }] };
}
function parsePersonio(xml, company, subdomain) {
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
    return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
  };
  return [...String(xml).matchAll(/<position>([\s\S]*?)<\/position>/g)].map(([, b]) => {
    const id = tag(b, 'id');
    const office = tag(b, 'office');
    return {
      source: `Personio (${company})`, sourceType: 'employer-ats', verificationTier: 1,
      externalId: id, title: tag(b, 'name'), company: company || tag(b, 'subcompany'),
      location: office ? `${office}, ${countryFrom(office, 'Germany')}` : 'Germany', country: countryFrom(office, 'Germany'),
      url: `https://${subdomain}.jobs.personio.de/job/${id}`,
      postedAt: (tag(b, 'createdAt') || '').slice(0, 10) || null,
      description: stripHtml(tag(b, 'value')).slice(0, 6000) + ' ' + tag(b, 'seniority') + ' ' + tag(b, 'yearsOfExperience'),
      seniority: tag(b, 'seniority') || null,
    };
  }).filter((l) => l.externalId && l.title);
}

// Workday public candidate-experience search endpoint (the same JSON the career site uses).
async function workday({ host, tenant, site, company, searchText = '', limit = 20, maxPages = 3 }) {
  const out = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await http(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit, offset: page * limit, searchText }),
    });
    const items = parseWorkday(data, { host, site, company });
    out.push(...items);
    if (items.length < limit) break;
  }
  return { leads: out, attempts: [{ query: `workday:${tenant}/${site} "${searchText}"`, results: out.length }] };
}
function parseWorkday(data, { host, site, company }) {
  return (data?.jobPostings || []).map((j) => ({
    source: `Workday (${company})`, sourceType: 'employer-ats', verificationTier: 1,
    externalId: (j.bulletFields || [])[0] || j.externalPath, title: j.title, company,
    location: j.locationsText || '', country: countryFrom(j.locationsText),
    url: `https://${host}/en-US/${site}${j.externalPath}`, postedAt: null,
    description: j.postedOn || '',
  })).filter((l) => l.title && l.externalId);
}

const ADAPTERS = { bundesagentur, arbeitnow, greenhouse, lever, smartrecruiters, personio, workday };

module.exports = {
  http, ADAPTERS, stripHtml, countryFrom,
  parsers: { parseBundesagentur, parseArbeitnow, parseGreenhouse, parseLever, parseSmartRecruiters, parsePersonio, parseWorkday },
};
