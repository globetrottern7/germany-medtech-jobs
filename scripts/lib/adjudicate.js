'use strict';
// Optional LLM adjudication. Disabled unless state/automation.json enables it AND an API key is
// present. The model only extracts evidence and proposes rubric sub-scores; every publication
// gate is enforced in code (see decide()). Without adjudication, leads stay in the review queue.

const { http, stripHtml } = require('./sources');

const GATE_VALUES = ['PASS', 'FAIL', 'UNCLEAR'];
const RUBRIC = { technicalSkillFit: 25, domainRelevance: 15, educationRelevance: 15, experienceCompatibility: 10, languageFit: 10, materialRequirements: 15, roleAlignment: 10 };

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['gates', 'scoreBreakdown', 'experienceRequirement', 'languageRequirement', 'deadline', 'roleType', 'category', 'fit', 'gaps', 'closedOrUnavailable'],
  properties: {
    gates: {
      type: 'object', additionalProperties: false,
      required: ['zero_year_eligible', 'degree_fit', 'language_feasible', 'technical_fit'],
      properties: Object.fromEntries(['zero_year_eligible', 'degree_fit', 'language_feasible', 'technical_fit'].map((g) => [g, {
        type: 'object', additionalProperties: false, required: ['result', 'evidence'],
        properties: { result: { type: 'string', enum: GATE_VALUES }, evidence: { type: 'string' } },
      }])),
    },
    scoreBreakdown: {
      type: 'object', additionalProperties: false, required: Object.keys(RUBRIC),
      properties: Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, { type: 'integer' }])),
    },
    experienceRequirement: { type: 'string' },
    languageRequirement: { type: 'string' },
    deadline: { type: ['string', 'null'], description: 'YYYY-MM-DD only if explicitly stated' },
    roleType: { type: 'string', enum: ['jobs', 'research'] },
    category: { type: 'array', items: { type: 'string' } },
    fit: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    closedOrUnavailable: { type: 'boolean' },
  },
};

function systemPrompt(profile, config) {
  return [
    'You adjudicate one job posting for a single candidate. Use ONLY the posting text supplied. Never invent facts.',
    'Quote short evidence from the posting for every gate. If the posting does not state something, answer UNCLEAR.',
    'Gate rules:',
    '- zero_year_eligible: PASS only for explicit 0 years / graduate / entry-level / Berufseinsteiger / Absolvent / a range including 0. 1+ years => FAIL unless graduates are explicitly accepted. "Junior" alone => UNCLEAR. Unstated => UNCLEAR.',
    '- language_feasible: candidate levels are given in CEFR. Requirement at or below candidate => PASS. One level above => FAIL unless lower level is explicitly accepted. "fließend/verhandlungssicher/sehr gute Deutschkenntnisse" => treat as C1. Unstated => PASS with evidence "unstated".',
    '- degree_fit: PASS if a biomedical/medical/electrical/computer engineering or comparable M.Sc. clearly qualifies.',
    '- technical_fit: PASS if the core tasks overlap materially with the candidate skills.',
    `Score rubric (integers, max per component): ${JSON.stringify(RUBRIC)}. Score CV-to-vacancy fit, not hiring probability.`,
    'roleType=research only for PhD/doctoral/doctoral-track research positions.',
    'closedOrUnavailable=true if the page says the job is closed, filled, expired or no longer available.',
    `Candidate profile: ${JSON.stringify(profile)}`,
    `Graduate signals used by this pipeline: ${JSON.stringify(config.graduateSignals || {})}`,
  ].join('\n');
}

async function fetchPostingText(url) {
  const html = await http(url, { as: 'text', timeoutMs: 25000 });
  return stripHtml(html).slice(0, 18000);
}

async function adjudicateWithOpenAI(lead, { profile, config, settings }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  let posting = lead.description || '';
  if (posting.length < 800 && lead.url) {
    try { posting = await fetchPostingText(lead.url); } catch (e) { posting = posting || ''; }
  }
  if (posting.length < 300) return { status: 'insufficient_evidence', reason: 'Full posting text could not be retrieved.' };
  const body = {
    model: process.env.OPENAI_MODEL || settings.model,
    messages: [
      { role: 'system', content: systemPrompt(profile, config) },
      { role: 'user', content: `Title: ${lead.title}\nEmployer: ${lead.company}\nLocation: ${lead.location}\nURL: ${lead.url}\n\nPosting text:\n${posting}` },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'adjudication', strict: true, schema: SCHEMA } },
  };
  const res = await http('https://api.openai.com/v1/chat/completions', {
    method: 'POST', timeoutMs: 90000,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const content = res?.choices?.[0]?.message?.content;
  return { status: 'ok', result: JSON.parse(content), model: res.model };
}

// Code-enforced gates. Returns { outcome: 'publish'|'provisional'|'exclude', match, gates, reasons }.
function decide(lead, result, { profile, minScore = 75, duplicate = false }) {
  const sb = {};
  for (const [k, max] of Object.entries(RUBRIC)) sb[k] = Math.max(0, Math.min(max, Math.round(Number(result.scoreBreakdown?.[k]) || 0)));
  const match = Object.values(sb).reduce((a, b) => a + b, 0);
  const base = profile?.workAuthorizationContext?.baseCountry || 'Germany';
  const gates = {
    current_open: result.closedOrUnavailable ? 'FAIL' : 'PASS',
    zero_year_eligible: result.gates.zero_year_eligible.result,
    degree_fit: result.gates.degree_fit.result,
    language_feasible: result.gates.language_feasible.result,
    work_authorization_feasible: lead.country === base ? 'PASS' : 'UNCLEAR',
    technical_fit: result.gates.technical_fit.result,
    verified_source: lead.verificationTier && lead.verificationTier <= 3 ? 'PASS' : 'UNCLEAR',
    not_duplicate: duplicate ? 'FAIL' : 'PASS',
  };
  const failed = Object.entries(gates).filter(([, v]) => v === 'FAIL').map(([k]) => k);
  const unclear = Object.entries(gates).filter(([, v]) => v === 'UNCLEAR').map(([k]) => k);
  if (failed.length) return { outcome: 'exclude', match, scoreBreakdown: sb, gates, reasons: failed.map((g) => `gate failed: ${g}`) };
  if (match < minScore) return { outcome: 'exclude', match, scoreBreakdown: sb, gates, reasons: [`score ${match} below ${minScore}`] };
  if (unclear.length) return { outcome: 'provisional', match, scoreBreakdown: sb, gates, reasons: unclear.map((g) => `gate unresolved: ${g}`) };
  return { outcome: 'publish', match, scoreBreakdown: sb, gates, reasons: [] };
}

module.exports = { adjudicateWithOpenAI, decide, RUBRIC, SCHEMA };
