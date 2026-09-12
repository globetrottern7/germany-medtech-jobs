# Europe MedTech Jobs — Production Baseline

**Purpose:** Stable production contract for the Europe-wide MedTech job-intelligence product. Daily vacancy counts belong in `data/reports.json`, not in this document.

## 1. Product principle

**Discover broadly; publish only after strict gates.** Germany receives materially deeper coverage; Europe is searched through a fixed source, country, language and semantic-role matrix.

The public portal publishes only current, evidence-backed vacancies with a genuine candidate fit and a **minimum 75% CV-match score**. **90%+ is the Strong Match view.** Scores represent CV-to-vacancy fit, not hiring probability.

## 2. Candidate profile

The current matching profile is externalized in `data/candidate-profile.json`: fresh M.Sc. Biomedical Engineering graduate, 0 years professional experience, English C1 and German B1, with C/C++, Python, MATLAB, LabVIEW, Arduino, embedded systems, biosignal/physiological signal analysis, ECG/EEG/EMG, sensor interfacing, validation, algorithm testing and medical-device project exposure.

The methodology must read the candidate profile rather than hard-code experience assumptions. A future internship, working-student role or professional experience changes the profile file and therefore the applicable gates.

## 3. Research/search methodology

### Mandatory Germany discovery baseline

Indeed, LinkedIn Jobs, XING Jobs (DACH priority), StepStone, Jobware, Monster, meinestadt.de, stellenanzeigen.de, Yourfirm, Kimeta, Jooble, Jobvector, Absolventa, JobTeaser and Stellenwerk.

These 15 sources are a baseline, never the complete universe.

### Additional source layers

- Bundesagentur für Arbeit, EURES, EURAXESS and public-employment sources.
- University, university-hospital and research-institute portals.
- Nature Careers, Academic Positions and academics.de.
- Direct employer career portals.
- Public employer/ATS vacancy endpoints where legitimately accessible: Workday, SAP SuccessFactors, Greenhouse, Lever, SmartRecruiters, Taleo, iCIMS, Personio, Recruitee, Ashby, Jobvite, Teamtailor and comparable systems.
- MedTech ecosystem sources: notified bodies/conformity-assessment organizations, testing/certification organizations, BVMed, MedicalMountains, VDE, IEEE EMBS, MedTech clusters, associations, startups, SMEs and university spin-outs.
- Specialist recruiters/staffing firms including FERCHAU, Bertrandt, Brunel and Hays Life Sciences.

For known employers, direct ATS/employer polling is preferred when a legitimate public feed/search endpoint exists. Never assume that an ATS exposes a public API. Fall back to the official career page when necessary.

### Search cadence

**Daily incremental layer:** prioritize vacancies appearing or changing in the past 24 hours / past week.

**Persistent broad-recall layer:** periodically repeat broad source and semantic searches because indexing is incomplete and delayed.

Standing Google Alerts and native LinkedIn/Indeed alerts may provide additional discovery signals between runs, but alerts are never publication evidence.

### Search families

Search obvious and hidden titles covering Biomedical Engineering, Medizintechnik, embedded/firmware/C/C++, DSP/signal processing/biosignals, ECG/EKG/EEG/EMG, sensors/wearables/physiological monitoring, imaging/data processing, validation/verification/test engineering, medical-device software/R&D, clinical applications, conformity assessment/certification, regulatory technical documentation, manufacturing/process engineering and research/PhD/graduate/trainee roles.

Do not require “Biomedical Engineer” in the vacancy title.

### Language coverage

Tier 1: English plus relevant local job-ad language(s) for priority countries on every cycle, with Germany receiving the deepest German search.

Tier 2: additional European languages and regional variants opportunistically when source/employer/vacancy evidence indicates value. The protocol may be broader than the identical daily execution depth; runs must record languages actually searched.

## 4. Verification and gates

Every published vacancy requires current official evidence where accessible: employer career page, employer ATS, university/research source or public-employment source. Job boards are discovery/cross-check sources, not substitutes for accessible official evidence.

Verify current/open status, application route, location, experience, language, work authorization and deadline where stated. Never invent missing information.

### Experience gate

- Explicit 0 years / graduate / recent graduate / entry-level: potentially eligible.
- Ranges including zero, such as 0–2 years: potentially eligible.
- 1+ / 2+ / 3+ years or explicit professional experience: exclude unless the employer explicitly accepts fresh graduates/zero years.
- No experience requirement stated: mark `unstated`, inspect the detailed context and require reasonable evidence of fresh-graduate eligibility before publication.
- “Junior” alone is not proof of zero-years eligibility.

### Language gate

Candidate equal/above stated CEFR: pass. One CEFR level below: material gap and normally exclude unless the employer explicitly accepts the lower level. Qualitative terms such as fluent/very good/business fluent are mapped conservatively and the reasoning is recorded. No stated language requirement remains `unstated`; do not infer one solely from country.

### Work authorization and context signals

Work authorization is assessed separately by vacancy country. German residence/post-study status does not automatically authorize work elsewhere in Europe.

Sponsorship and relocation are separate signals:
- `sponsorship.offered = yes|no|unclear`
- `relocation.offered = yes|no|unclear`

These signals never override an authorization restriction. MSCA mobility is checked separately for MSCA-funded opportunities.

## 5. Vacancy identity, freshness and change detection

Canonical vacancy fingerprint = normalized **company + title + primary location + country**. Normalize case, punctuation/separators and whitespace and clearly equivalent employer legal suffixes. URL is not an identity key.

Fresh = the fingerprint has never appeared in a prior archived report. Reposts, duplicate board copies, changed URLs and changed posting dates do not become Fresh when the underlying requisition is the same.

Detect material changes to known vacancies: deadline, experience, language, sponsorship, relocation, location, title, material eligibility/description and open/closed state. A material change does not automatically create a new vacancy.

## 6. Fixed scoring rubric

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

Authorization is a separate gate. Scores are reproducible from the candidate profile and vacancy evidence. Historical records without component scores must not receive invented retrospective subscores.

## 7. Publication bands

- **<75:** never display in the portal.
- **75–89:** Qualified Match.
- **90–100:** Strong Match.

Lower-scoring records may remain in raw data for audit/history but must not appear in the public published set.

## 8. False-negative control

After the initial shortlist, deliberately search adjacent titles, local-language variants, graduate programmes, specialist recruiters, research sources, notified bodies, associations/clusters and known employer ATS pages. Record the hunt and exclusions.

## 9. Quality assurance

Every run records source groups, countries/languages, candidate universe, exclusions, new vacancies, material changes, closed vacancies, false-negative hunts and limitations.

Required reconciliation:
- published report IDs must refer to active jobs with `match >=75`;
- fresh IDs must be a subset of published IDs;
- no duplicate canonical fingerprints in the published set;
- daily counts are derived from `reports.json`, not manually copied into this document.

If a daily run is skipped or fails, record a missed run. The next successful run performs incremental discovery plus catch-up verification and a broad-recall check.

The former OpenAI API/GitHub Actions research path was retired after API credit exhaustion; production research uses direct ChatGPT web research and direct GitHub updates.

## 10. Portal product

The portal is a job-intelligence and candidate-tracking product.

### Discovery UX

Filters: country, CV match, language signal, deadline window, company, role family and application status. Sorting: best match, closing soon, fresh first, company. Combined filters are supported.

### Job card

Show CV score, Fresh/Previously Listed state, deadline countdown, sponsorship/relocation signals, fit reasons, gaps, score breakdown when available, application link and tracking controls.

### Tracker

Candidate-local workflow: **New → Wishlist → Applied → Interviewing → Offer / Rejected**. Store status date, notes, follow-up date and connection/referral status. This state is private browser-local state in the current static implementation and is not written to public research data.

### Company view

Group current and historical published vacancies by employer so strong employers remain visible even without a current match.

### Map view

Plot published vacancies where reliable coordinates are available and cluster nearby opportunities. Unknown/unmappable locations remain in the Jobs view.

### Export

Export the current filtered view to CSV, including candidate-local tracker fields only in the browser-generated export.

### About page

A recruiter-facing explanation of the problem, discovery pipeline, verification, scoring, historical controls, false-negative hunting and the product/system skills demonstrated by building it. The page must describe only capabilities actually running.

### Opportunity Radar

A concise explanation of adjacent role families being searched; it is context for discovery, not a second recommendation pool.

## 11. Source-of-truth files

- `data/jobs.json` — vacancy-level research truth.
- `data/reports.json` — daily published snapshots/history.
- `data/research-status.json` — latest run/status.
- `data/candidate-profile.json` — candidate matching inputs.
- `DATA_SCHEMAS.md` — operational schema definitions.
- `RESEARCH_SETUP.md` — execution-oriented research/search instructions.

The specification defines stable rules; operational files define what happened on a particular run.
