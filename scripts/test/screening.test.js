'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { prescreen } = require('../lib/prescreen');
const { decide } = require('../lib/adjudicate');
const { identityKey, matchKey } = require('../lib/identity');
const profile = { languages: { English: 'C1', German: 'B1' }, technicalSkills: ['Python', 'MATLAB', 'C/C++'], workAuthorizationContext: { baseCountry: 'Germany' } };
const lead = (title, description = '') => ({ title, description, company: 'X', location: 'Berlin, Germany', country: 'Germany' });

test('prescreen rejects seniority, student roles and multi-year requirements', () => {
  assert.equal(prescreen(lead('Senior Software Engineer Medical Devices'), { profile }).decision, 'reject');
  assert.equal(prescreen(lead('Werkstudent Medizintechnik (m/w/d)'), { profile }).decision, 'reject');
  assert.equal(prescreen(lead('Software Engineer Medical Devices', 'mindestens 3 Jahre Berufserfahrung'), { profile }).decision, 'reject');
  assert.equal(prescreen(lead('Software Engineer Medical Devices', 'at least 2 years of experience'), { profile }).decision, 'reject');
});

test('prescreen rejects German C1-level requirement for a B1 candidate', () => {
  const r = prescreen(lead('Entwicklungsingenieur Medizintechnik', 'Absolventen willkommen. Verhandlungssichere Deutschkenntnisse.'), { profile });
  assert.equal(r.decision, 'reject');
  assert.match(r.reasons[0], /German/);
});

test('prescreen keeps a graduate MedTech engineering lead', () => {
  const r = prescreen(lead('Graduate Verification Engineer', 'Medical device verification for recent graduates. Python, MATLAB.'), { profile });
  assert.equal(r.decision, 'lead');
  assert.ok(r.relevance > 30);
});

test('prescreen rejects non-domain roles', () => {
  assert.equal(prescreen(lead('Software Engineer', 'Online shop backend in Python'), { profile }).decision, 'reject');
});

const okResult = (over = {}) => ({
  gates: { zero_year_eligible: { result: 'PASS', evidence: 'Berufseinsteiger' }, degree_fit: { result: 'PASS', evidence: '' }, language_feasible: { result: 'PASS', evidence: '' }, technical_fit: { result: 'PASS', evidence: '' } },
  scoreBreakdown: { technicalSkillFit: 22, domainRelevance: 14, educationRelevance: 14, experienceCompatibility: 10, languageFit: 9, materialRequirements: 12, roleAlignment: 9 },
  closedOrUnavailable: false, ...over,
});

test('decide publishes only when every gate passes and score >= 75', () => {
  const d = decide({ country: 'Germany', verificationTier: 1 }, okResult(), { profile });
  assert.equal(d.outcome, 'publish');
  assert.equal(d.match, 90);
});

test('decide clamps inflated sub-scores', () => {
  const d = decide({ country: 'Germany', verificationTier: 1 }, okResult({ scoreBreakdown: { technicalSkillFit: 99, domainRelevance: 99, educationRelevance: 99, experienceCompatibility: 99, languageFit: 99, materialRequirements: 99, roleAlignment: 99 } }), { profile });
  assert.equal(d.match, 100);
});

test('decide: a failed gate cannot be rescued by score', () => {
  const r = okResult();
  r.gates.zero_year_eligible.result = 'FAIL';
  assert.equal(decide({ country: 'Germany', verificationTier: 1 }, r, { profile }).outcome, 'exclude');
});

test('decide: non-base country or aggregator source stays provisional', () => {
  assert.equal(decide({ country: 'Ireland', verificationTier: 1 }, okResult(), { profile }).outcome, 'provisional');
  assert.equal(decide({ country: 'Germany', verificationTier: 5 }, okResult(), { profile }).outcome, 'provisional');
});

test('identityKey matches the existing registry format', () => {
  assert.equal(identityKey({ company: 'MAICO Diagnostics GmbH', title: 'DSP Engineer (f/m/d)', location: 'Berlin, Germany', country: 'Germany' }), 'maico diagnostics gmbh|dsp engineer (f/m/d)|berlin, germany|germany');
});

test('matchKey treats gender tags, legal suffixes and URL-free variants as the same vacancy', () => {
  const a = matchKey({ company: 'Siemens Healthineers AG', title: 'Embedded Engineer (m/w/d)', location: 'Erlangen, Bayern', country: 'Germany' });
  const b = matchKey({ company: 'Siemens Healthineers', title: 'Embedded Engineer (w/m/d)', location: 'Erlangen', country: 'Germany' });
  assert.equal(a, b);
});
