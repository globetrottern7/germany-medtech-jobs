'use strict';
// Canonical identity helpers.
//
// identityKey(): the stored registry key, matching the existing state/vacancies.jsonl format
//   (lower-cased, whitespace-collapsed company|title|location|country).
// matchKey(): a looser key used only for duplicate detection, normalising punctuation,
//   gender tags such as (m/w/d), and equivalent legal suffixes (GmbH, SE & Co. KGaA, ...).

const clean = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function identityKey(v) {
  return [v.company, v.title, v.location, v.country].map(clean).join('|');
}

const LEGAL = /\b(gmbh|ag|se|kg|kgaa|ohg|ug|mbh|co|inc|ltd|llc|plc|bv|b v|nv|n v|sa|sas|srl|spa|ab|as|oy|limited|corporation|corp|group|holding|deutschland|germany)\b/g;
const GENDER = /\((?:[mwfdxi]\s*\/\s*){1,3}[mwfdxi]\)|\((?:all genders|alle geschlechter|gn\*?|m\/w\/d\/x)\)|\b[mwfd]\/[mwfd]\/[mwfdx]\b/gi;

function fold(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

function normCompany(s) {
  return fold(s).replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(LEGAL, ' ').replace(/\s+/g, ' ').trim();
}

function normTitle(s) {
  return fold(String(s ?? '').replace(GENDER, ' ')).replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normCity(location) {
  // Primary location = first segment before a comma / slash / dash list.
  const first = String(location ?? '').split(/[,;/|]| - | – /)[0];
  return fold(first).replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchKey(v) {
  return [normCompany(v.company), normTitle(v.title), normCity(v.location), fold(v.country).replace(/[^a-z]+/g, '')].join('|');
}

function slug(s, max = 60) {
  return fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

module.exports = { identityKey, matchKey, normCompany, normTitle, normCity, slug, fold };
