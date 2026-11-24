'use strict';
// Deterministic, conservative pre-screen. It never publishes anything: it only decides whether a
// discovered lead is worth adjudicating (human or optional LLM) or is an obvious reject.
// Rejections are logged with reasons so they stay auditable.
//
// Matching is word-boundary based: a term must start at a word boundary (so "mri" does not match
// "primary"), and short acronyms must also end at one. Stems such as "medizintechn" may continue.

const { fold } = require('./identity');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function terms(list) {
  return list.map(fold).map((t) => {
    const whole = t.length <= 4 || /\s/.test(t) && t.split(' ').every((w) => w.length <= 4);
    return { t, re: new RegExp(`(?<![a-z0-9])${esc(t)}${whole ? '(?![a-z0-9])' : ''}`) };
  });
}
const hits = (list, text) => list.filter(({ re }) => re.test(text)).map(({ t }) => t);

const TITLE_REJECT = [
  [/\b(senior|sr\.?|lead|leading|principal|staff|head of|director|direktor|chief|vp|vice president)\b/, 'seniority title'],
  [/\b(leiter|leiterin|leitung|teamleit\w*|abteilungsleit\w*|gruppenleit\w*|bereichsleit\w*)\b/, 'leadership title'],
  [/\b(werkstudent\w*|working student|praktik\w*|intern|internship|stage|stagiaire|ausbildung|azubi|auszubildend\w*|duales studium|dual student|abschlussarbeit|masterarbeit|bachelorarbeit|thesis|minijob|aushilfe|studentische hilfskraft|hiwi)\b/, 'student/trainee-only role'],
  [/\b(sales|vertrieb\w*|account\w*|key account|business development|marketing|growth|recruit\w*|personalberat\w*|talent|hr|buchhalt\w*|accountant|controller|customer support|it support|helpdesk|service desk|customer success|kundenservice|operations manager|product manager|project manager|projektmanager|program manager|manager|managerin|consultant|berater\w*|analyst|architect|architekt\w*|administrator|pflege\w*|nurse|arzt|arztin|physician|therapeut\w*)\b/, 'non-engineering function'],
];

// The role itself must be technical/scientific: this is checked on the TITLE only.
const TITLE_FUNCTION = terms(['engineer', 'engineering', 'ingenieur', 'entwickler', 'developer', 'scientist', 'wissenschaftl', 'researcher', 'research assistant', 'research associate', 'doktorand', 'phd', 'doctoral', 'specialist', 'spezialist', 'applikation', 'application', 'quality', 'qualität', 'regulatory', 'zulassung', 'validation', 'validierung', 'verification', 'verifikation', 'test', 'tester', 'testing', 'prufingenieur', 'trainee', 'graduate', 'absolvent', 'r&d', 'firmware', 'embedded', 'software', 'signal', 'algorithm', 'biomedical', 'medizintechnik', 'systems', 'hardware', 'elektronik', 'electronics', 'sensor']);

const STRONG_DOMAIN = terms(['medizintechn', 'medical device', 'medical devices', 'medical technology', 'medtech', 'med tech', 'medizinprodukt', 'biomedical', 'biomedizin', 'iso 13485', 'iec 62304', 'iso 14971', 'iec 60601', 'mdr', 'ivdr', 'notified body', 'benannte stelle', 'ecg', 'ekg', 'eeg', 'emg', 'hörgerät', 'hearing aid', 'hearing implant', 'cochlear', 'implant', 'prothes', 'prosthe', 'orthes', 'orthotic', 'ultrasound', 'ultraschall', 'medical imaging', 'bildgebung', 'mri', 'mrt', 'ct scanner', 'vital sign', 'vitalparameter', 'physiolog', 'patient monitoring', 'patientenmonitoring', 'electrophysiolog', 'catheter', 'katheter', 'surgical', 'chirurg', 'in vitro diagnostic', 'ivd', 'neurotech', 'biosignal']);
const WEAK_DOMAIN = terms(['patient', 'healthcare', 'health care', 'klinik', 'clinical', 'diagnost', 'health tech', 'healthtech', 'life science', 'life sciences', 'wearable', 'hospital', 'krankenhaus', 'medical', 'medizin']);

const EXPERIENCE_PATTERNS = [
  /(?:mindestens|min\.?|at least|minimum(?: of)?)\s*(\d{1,2})\s*(?:\+\s*)?(?:jahre|jahren|years?)/g,
  /(\d{1,2})\s*\+\s*(?:jahre|years?)/g,
  /(\d{1,2})\s*(?:-|–|bis|to)\s*\d{1,2}\s*(?:jahre|years?)\s*(?:berufserfahrung|experience|of experience|professional)/g,
  /(\d{1,2})\s*(?:jahre|years?)\s*(?:\w+\s){0,3}(?:berufserfahrung|experience|erfahrung)/g,
];
const EXPERIENCE_WORDS = /(mehrjahrige|langjahrige|several years|many years|extensive experience|proven track record|fundierte berufserfahrung)/;
const GERMAN_HIGH = /(verhandlungssicher|fliessend\w* deutsch|deutsch\w* fliessend|sehr gute\w* deutsch|exzellente\w* deutsch|deutsch\w*\s*(?:auf\s*)?(?:niveau\s*)?c[12]|german\s*\(?c[12]|fluent (?:in )?german|business[- ]fluent german|native german|muttersprach)/;
const GRADUATE_EXTRA = ['berufseinsteiger', 'absolvent', 'direkteinstieg', 'einstieg', 'entry level', 'entry-level', 'graduate', 'new grad', 'recent graduate', 'junior', 'trainee', 'nachwuchs', '0-2 years', '0–2 years', 'no experience required', 'keine berufserfahrung'];

function prescreen(lead, { config = {}, profile = {} } = {}) {
  const title = fold(lead.title);
  const text = fold(`${lead.title} ${lead.description || ''}`);
  const reasons = [];

  for (const [re, why] of TITLE_REJECT) {
    if (re.test(title)) return { decision: 'reject', reasons: [why], relevance: 0, signals: {} };
  }
  const functionHits = hits(TITLE_FUNCTION, title);
  if (!functionHits.length) return { decision: 'reject', reasons: ['no engineering/science function in title'], relevance: 0, signals: {} };

  const strong = hits(STRONG_DOMAIN, text);
  const weak = hits(WEAK_DOMAIN, text);
  const weakInTitle = hits(WEAK_DOMAIN, title);
  const domainHits = [...strong, ...weak];
  const skillHits = (profile.technicalSkills || []).map(fold).filter((k) => k.length > 2 && text.includes(k));
  const positives = [...(config.graduateSignals?.positive || []), ...GRADUATE_EXTRA].map(fold);
  const graduateHits = [...new Set(positives.filter((k) => text.includes(k)))];

  let maxYears = 0;
  for (const re of EXPERIENCE_PATTERNS) {
    for (const m of text.matchAll(re)) maxYears = Math.max(maxYears, Number(m[1]) || 0);
  }
  const experienceWords = EXPERIENCE_WORDS.test(text);
  const germanHigh = GERMAN_HIGH.test(text);
  const signals = { domainHits, functionHits, skillHits, graduateHits, maxYearsRequired: maxYears || null, experienceWords, germanHigh };

  const domainOk = strong.length >= 1 || (weak.length >= 2 && weakInTitle.length >= 1);
  if (!domainOk) return { decision: 'reject', reasons: ['no MedTech/biomedical domain signal'], relevance: 0, signals };

  const explicitZero = /(0\s*(?:-|–|bis|to)\s*\d\s*(?:jahre|years?)|no (?:prior )?experience required|keine berufserfahrung|berufseinsteiger|recent graduate|absolvent)/.test(text);
  if (maxYears >= 1 && !explicitZero) return { decision: 'reject', reasons: [`requires ${maxYears}+ years experience`], relevance: 0, signals };
  if (experienceWords && !explicitZero) return { decision: 'reject', reasons: ['requires multi-year professional experience'], relevance: 0, signals };

  const germanLevel = (profile.languages || {}).German || 'B1';
  if (germanHigh && /^(A1|A2|B1|B2)$/i.test(germanLevel)) {
    return { decision: 'reject', reasons: [`German requirement appears above candidate level (${germanLevel})`], relevance: 0, signals };
  }

  const relevance = Math.min(100,
    Math.min(strong.length, 3) * 15 + Math.min(weak.length, 2) * 5 +
    Math.min(functionHits.length, 3) * 8 +
    Math.min(skillHits.length, 4) * 4 +
    (graduateHits.length ? 15 : 0));
  if (!graduateHits.length) reasons.push('experience requirement not visible in summary — needs full-posting check');
  if (lead.description && lead.description.length < 300) reasons.push('short listing text — full posting must be read before adjudication');
  return { decision: 'lead', reasons, relevance, signals };
}

module.exports = { prescreen };
