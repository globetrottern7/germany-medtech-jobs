'use strict';
// Deterministic, conservative pre-screen. It never publishes anything: it only decides whether a
// discovered lead is worth adjudicating (human or optional LLM) or is an obvious reject.
// Rejections are logged with reasons so they stay auditable.

const { fold } = require('./identity');

const TITLE_REJECT = [
  [/\b(senior|sr\.?|lead|leading|principal|staff|head of|director|direktor|chief|vp|vice president)\b/, 'seniority title'],
  [/\b(leiter|leiterin|leitung|teamleit\w*|abteilungsleit\w*|gruppenleit\w*|bereichsleit\w*)\b/, 'leadership title'],
  [/\b(werkstudent\w*|working student|praktik\w*|intern|internship|ausbildung|azubi|auszubildend\w*|duales studium|dual student|abschlussarbeit|masterarbeit|bachelorarbeit|thesis|minijob|aushilfe|studentische hilfskraft|hiwi)\b/, 'student/trainee-only role'],
];

const DOMAIN = ['medizintechn', 'medical device', 'medical technology', 'medtech', 'medizinprodukt', 'biomedical', 'biomedizin', 'medizinische', 'healthcare', 'health tech', 'diagnost', 'patient', 'klinik', 'clinical', 'hearing', 'hörgerät', 'implant', 'orthop', 'prothe', 'imaging', 'bildgebung', 'ultrasound', 'ultraschall', 'mrt', 'mri', 'ecg', 'ekg', 'eeg', 'emg', 'physiolog', 'vital sign', 'wearable', 'iso 13485', 'iec 62304', 'iso 14971', 'iec 60601', 'mdr', 'notified body', 'benannte stelle', 'life science'];
const FUNCTION = ['engineer', 'ingenieur', 'entwickl', 'developer', 'software', 'firmware', 'embedded', 'hardware', 'elektronik', 'signal', 'algorithm', 'algorithmus', 'data scien', 'test', 'verification', 'verifikation', 'validation', 'validierung', 'quality', 'qualität', 'regulatory', 'zulassung', 'application specialist', 'applikation', 'field clinical', 'clinical specialist', 'research', 'wissenschaftl', 'doktorand', 'phd', 'trainee', 'graduate', 'absolvent', 'sensor', 'matlab', 'labview', 'python', 'c++', 'systems engineer', 'systemingenieur', 'r&d', 'forschung'];

const EXPERIENCE_PATTERNS = [
  /(?:mindestens|min\.?|at least|minimum(?: of)?)\s*(\d{1,2})\s*(?:\+\s*)?(?:jahre|jahren|years?)/g,
  /(\d{1,2})\s*\+\s*(?:jahre|years?)/g,
  /(\d{1,2})\s*(?:-|–|bis|to)\s*\d{1,2}\s*(?:jahre|years?)\s*(?:berufserfahrung|experience|of experience|professional)/g,
  /(\d{1,2})\s*(?:jahre|years?)\s*(?:\w+\s){0,3}(?:berufserfahrung|experience|erfahrung)/g,
];
const EXPERIENCE_WORDS = /(mehrjährige|langjährige|several years|many years|extensive experience|proven track record|fundierte berufserfahrung)/;
const GERMAN_HIGH = /(verhandlungssicher|fließend\w* deutsch|deutsch\w* fließend|sehr gute\w* deutsch|exzellente\w* deutsch|deutsch\w*\s*(?:auf\s*)?(?:niveau\s*)?c[12]|german\s*\(?c[12]|fluent (?:in )?german|business[- ]fluent german|native german|muttersprach)/;
const GRADUATE_EXTRA = ['berufseinsteiger', 'absolvent', 'direkteinstieg', 'einstieg', 'entry level', 'entry-level', 'graduate', 'new grad', 'recent graduate', 'junior', 'trainee', 'nachwuchs', '0-2 years', '0–2 years', 'no experience required', 'keine berufserfahrung'];

function prescreen(lead, { config = {}, profile = {} } = {}) {
  const title = fold(lead.title);
  const text = fold(`${lead.title} ${lead.description || ''}`);
  const reasons = [];

  for (const [re, why] of TITLE_REJECT) {
    if (re.test(title)) return { decision: 'reject', reasons: [why], relevance: 0, signals: {} };
  }

  const domainHits = DOMAIN.filter((k) => text.includes(k));
  const functionHits = FUNCTION.filter((k) => text.includes(k));
  const skillHits = (profile.technicalSkills || []).map(fold).filter((k) => k.length > 2 && text.includes(k));

  const positives = [...(config.graduateSignals?.positive || []), ...GRADUATE_EXTRA].map(fold);
  const graduateHits = positives.filter((k) => text.includes(k));

  let maxYears = 0;
  for (const re of EXPERIENCE_PATTERNS) {
    for (const m of text.matchAll(re)) maxYears = Math.max(maxYears, Number(m[1]) || 0);
  }
  const experienceWords = EXPERIENCE_WORDS.test(text);
  const germanHigh = GERMAN_HIGH.test(text);
  const signals = { domainHits, functionHits, skillHits, graduateHits, maxYearsRequired: maxYears || null, experienceWords, germanHigh };

  if (!domainHits.length) return { decision: 'reject', reasons: ['no MedTech/biomedical domain signal'], relevance: 0, signals };
  if (!functionHits.length) return { decision: 'reject', reasons: ['no engineering/science/QA/clinical function signal'], relevance: 0, signals };

  const explicitZero = /(0\s*(?:-|–|bis|to)\s*\d\s*(?:jahre|years?)|no (?:prior )?experience required|keine berufserfahrung|berufseinsteiger|recent graduate|absolvent)/.test(text);
  if (maxYears >= 1 && !explicitZero) return { decision: 'reject', reasons: [`requires ${maxYears}+ years experience`], relevance: 0, signals };
  if (experienceWords && !explicitZero) return { decision: 'reject', reasons: ['requires multi-year professional experience'], relevance: 0, signals };

  const germanLevel = (profile.languages || {}).German || 'B1';
  if (germanHigh && /^(A1|A2|B1|B2)$/i.test(germanLevel)) {
    reasons.push(`German requirement appears above candidate level (${germanLevel})`);
    return { decision: 'reject', reasons, relevance: 0, signals };
  }

  const relevance = Math.min(100,
    Math.min(domainHits.length, 4) * 10 +
    Math.min(functionHits.length, 4) * 8 +
    Math.min(skillHits.length, 4) * 5 +
    (graduateHits.length ? 15 : 0));
  if (!graduateHits.length) reasons.push('experience requirement not visible in summary — needs full-posting check');
  if (lead.description && lead.description.length < 300) reasons.push('short listing text — full posting must be read before adjudication');
  return { decision: 'lead', reasons, relevance, signals };
}

module.exports = { prescreen };
