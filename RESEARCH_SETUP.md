# Europe MedTech Jobs — Research / Search Setup

The production research path uses a recall-first Europe-wide methodology with Germany materially deeper than other European markets. ChatGPT performs the web research directly, verifies underlying vacancy sources, compares results with the historical archive, and writes the verified report directly to this GitHub repository.

## Production architecture

`Broad discovery → source verification → vacancy fingerprint/change detection → strict adjudication → fixed scoring → historical comparison → GitHub update`

The daily automation **Daily Europe MedTech Jobs** runs at 5 PM Europe/Berlin time.

## Research source universe

### Mandatory Germany discovery baseline

1. Indeed
2. LinkedIn Jobs
3. XING Jobs — explicit DACH priority
4. StepStone
5. Jobware
6. Monster
7. meinestadt.de
8. stellenanzeigen.de
9. Yourfirm
10. Kimeta
11. Jooble
12. Jobvector
13. Absolventa
14. JobTeaser
15. Stellenwerk

These are a baseline, not a ceiling.

### Public, academic and research sources

- Bundesagentur für Arbeit
- EURES
- EURAXESS
- university and university-hospital portals
- research institutes
- Nature Careers
- Academic Positions
- academics.de
- national/regional public-employment sources

### Employer and ATS sources

Direct employer career pages are preferred. For known employers, poll a legitimate public ATS/employer vacancy feed or searchable endpoint where available, including Workday, SAP SuccessFactors, Greenhouse, Lever, SmartRecruiters, Taleo, iCIMS, Personio, Recruitee, Ashby, Jobvite, Teamtailor and comparable systems. Do not assume that an ATS exposes a public API/feed; fall back to the official career page when it does not.

### MedTech ecosystem and adjacent job families

Search beyond device manufacturers for:
- notified bodies / conformity-assessment organizations;
- device testing and certification organizations;
- regulatory and technical-documentation employers;
- BVMed;
- MedicalMountains;
- VDE;
- IEEE EMBS;
- MedTech clusters, associations and member/partner vacancy pages;
- startups, SMEs and university spin-outs;
- specialist engineering/science/healthcare recruiters including FERCHAU, Bertrandt, Brunel and Hays Life Sciences.

Conformity-assessment and regulatory roles are genuine discovery families, but every role still has to pass candidate-specific fit and publication gates.

## Search cadence

### Daily incremental layer

Prioritize vacancies appearing or changing in the past 24 hours / past week. This is the new-discovery layer.

### Persistent broad-recall layer

Periodically rerun broad source/semantic searches. This is mandatory because search engines and job boards can index vacancies late or expose different subsets on different days.

### Standing alerts

Google Alerts and native LinkedIn/Indeed saved-search alerts may be used as between-run discovery signals. Alerts are never publication evidence. Every alert lead must be independently verified.

## Search taxonomy

Search both obvious and hidden titles across:
- Biomedical Engineering / Medizintechnik;
- embedded software / firmware / C/C++;
- DSP / signal processing / biosignal processing;
- ECG/EKG / EEG / EMG / electrophysiology;
- sensors / wearables / physiological monitoring;
- medical imaging / data processing;
- validation / verification / test engineering;
- medical-device software/R&D;
- clinical applications;
- conformity assessment / certification / regulatory technical documentation;
- manufacturing/process engineering for medical devices;
- research assistant / PhD / graduate / trainee / early-career roles.

Do not require “Biomedical Engineer” to appear in the title.

## Language protocol

**Tier 1 — every cycle:** English plus the relevant local job-ad language(s) for priority countries, with Germany receiving the deepest German-language search.

**Tier 2 — opportunistic:** additional lower-priority European languages and regional variants when source/employer/vacancy evidence suggests likely value.

The protocol language universe is broader than the daily minimum; the system must not claim identical depth for every language on every run.

## Mandatory verification

A published vacancy must have current official evidence where accessible: employer career page, employer ATS, university/research source or public-employment source. Job boards are discovery sources and cross-checks, not substitutes for an accessible official source.

Verify:
- current/open status;
- experience eligibility;
- application route;
- location;
- language;
- country-specific work authorization;
- deadline where stated.

Never invent missing fields.

## Experience rule

- Explicit 0 years / graduate / recent graduate / entry-level: potentially eligible.
- Range including zero, such as 0–2 years: potentially eligible.
- 1+ / 2+ / 3+ years or explicit prior professional experience: exclude unless the employer explicitly accepts fresh graduates/zero experience.
- No experience requirement stated: mark `experienceRequirement=unstated`; inspect the detailed posting/context and require reasonable evidence of fresh-graduate eligibility before publication.
- “Junior” by title alone is insufficient.

## Language rule

- Candidate meets/exceeds explicit CEFR requirement: pass.
- One CEFR level below: material gap; normally exclude unless the employer explicitly accepts the lower level.
- Qualitative requirements such as fluent/very good/business fluent are mapped conservatively and the reasoning is recorded.
- No stated language requirement: `languageRequirement=unstated`; do not infer one solely from country.

## Work authorization, sponsorship and relocation

Work authorization is a hard country/role-specific eligibility consideration. German residence/post-study status does not automatically authorize work elsewhere in Europe.

Sponsorship and relocation are recorded separately as context signals:
- `sponsorship.offered = yes|no|unclear`
- `relocation.offered = yes|no|unclear`

These signals never override an authorization restriction.

For MSCA-funded opportunities, mobility eligibility is checked separately from technical fit.

## Vacancy fingerprint and freshness

Canonical identity is based on normalized:
`company + title + primary location + country`.

Normalize case, punctuation/separators and whitespace and normalize clearly equivalent employer legal-suffix variants. URL/query parameters are not identity keys.

A vacancy is Fresh only if its fingerprint has never appeared in prior archived reports. A repost, duplicate board copy, changed URL or changed posting date does not make it fresh.

Material changes to a known vacancy — deadline, experience, language, sponsorship, relocation, location, title or material eligibility — are recorded as changes but do not automatically create a new vacancy/fresh record.

## Scoring and publication

Fixed 100-point CV-fit rubric:

| Component | Weight |
|---|---:|
| Technical / skill fit | 25 |
| MedTech / domain relevance | 15 |
| Education relevance | 15 |
| Experience compatibility | 10 |
| Language fit | 10 |
| Material requirements / gaps | 15 |
| Role / function alignment | 10 |
| **Total** | **100** |

Authorization remains a separate gate.

- `<75`: not published.
- `75–89`: Qualified Match.
- `90–100`: Strong Match.

Do not invent retrospective component scores for historical records that lack them.

## False-negative hunt

After the initial shortlist, deliberately search adjacent titles, ecosystem categories, local-language variants, graduate programmes, specialist recruiters, research sources, notified bodies and known employer ATS pages. Record what was searched and what was excluded.

## QA and failed-run handling

Each run records source groups, countries/languages, candidate universe, exclusions, new/changed/closed vacancies, false-negative hunts and limitations.

Required consistency checks:
- published report IDs are active and match >=75%;
- fresh IDs are a subset of published IDs;
- no duplicate canonical fingerprints in the published set;
- daily counts are derived from `reports.json`, not copied into the methodology document.

If a daily run is skipped or fails, record a missed run rather than fabricating a report. The next successful run performs incremental discovery plus catch-up verification and a broad-recall check.

## Production data

- `data/jobs.json` — vacancy-level research source of truth.
- `data/reports.json` — daily published snapshots/history.
- `data/research-status.json` — latest run status and coverage.
- `data/candidate-profile.json` — candidate matching inputs.
- `DATA_SCHEMAS.md` — operational data definitions.

## Retired research path

The previous OpenAI API/GitHub Actions research workflow was removed after API credit exhaustion made it unreliable. Production research uses direct ChatGPT web research and direct GitHub updates; the retired API path must not be reintroduced as the default.
