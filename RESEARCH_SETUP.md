# Research setup

The production research path uses the same recall-first approach as the established Germany search, but with an explicit source matrix. ChatGPT performs the web research directly, verifies underlying vacancy sources, compares results with the historical archive, and writes the verified Europe-wide report directly to this GitHub repository.

## Production architecture

`Broad discovery everywhere relevant → source verification → strict adjudication → historical comparison → GitHub update`

The daily automation **Daily Europe MedTech Jobs** runs at 5 PM Europe/Berlin time. It searches Germany first and then the wider European MedTech/health-tech market.

## API credits are not required for the research path

This production workflow does **not** depend on the OpenAI API, `OPENAI_API_KEY`, or GitHub Actions to perform the research. The earlier GitHub Actions/OpenAI API implementation has been removed from the production path.

## Source coverage model: 15 + everything else relevant

The 15 named German portals are a **mandatory discovery baseline**, not the complete source universe:

1. Indeed
2. LinkedIn Jobs
3. XING Jobs
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

The search must also continue beyond these 15. Additional mandatory source layers include:

- Bundesagentur für Arbeit (BA)
- EURES
- EURAXESS
- National and regional public-employment portals
- University and university-hospital career portals
- Research institutes and research-vacancy systems
- Direct company career portals
- Employer-hosted vacancy pages and ATS systems such as Workday, SAP SuccessFactors, Greenhouse, Lever, SmartRecruiters, Taleo, iCIMS, Personio, Recruitee, Ashby, Jobvite, Teamtailor and other relevant ATS platforms
- German and European MedTech cluster/industry portals and associations
- MedTech startups, SMEs and university spin-outs
- Specialist engineering, science and healthcare recruiters
- Any other reputable job boards, aggregators or specialist vacancy sources discovered during the search

The objective is **maximum discovery/recall first, followed by strict publication accuracy**. The 15 portals must never become a ceiling on discovery.

## Research rules

- Germany first, with materially deeper coverage than other European countries, followed by Europe-wide coverage.
- Build a broad candidate pool before adjudication; do not search only for obvious job titles.
- Search English, German and relevant local-language equivalents using a fixed semantic role-family matrix.
- Include regular jobs, graduate programs, junior roles, trainee programs and research/PhD opportunities. PhD-only searching is not permitted.
- Job boards and aggregators are primarily discovery sources. Prefer and verify the underlying employer, ATS, university, research or public source whenever possible.
- A vacancy found only on a job board may be retained for investigation, but must not be treated as equally verified if the underlying source cannot be established.
- Strictly filter for fresh-graduate/0-years suitability. "Junior" by title alone is insufficient; the actual experience requirement must allow 0 years.
- Require genuine technical/CV match, not title similarity.
- Verify that vacancies are currently open before publishing.
- Assess explicit language requirements and record material language gaps.
- Assess work authorization separately by country; do not assume a German residence status automatically grants work rights elsewhere in Europe.
- Deduplicate by vacancy fingerprint rather than URL.
- Preserve Fresh vs Previously Listed history using the exact vacancy fingerprint.
- Re-verify prior published vacancies and run a false-negative hunt after the first shortlist.
- Publish every genuine match found; never inflate counts to hit a target.
- Never publish candidate personal identifiers.

## Germany search families

At minimum, search semantic variants covering Medizintechnik, Biomedical Engineering, Medizinelektronik, medical imaging/data processing, signal processing, biosignal processing, ECG/EKG, EEG, EMG, DSP, digital signal processing, algorithm engineering, embedded software, embedded C/C++, firmware, medical-device software/R&D, sensors, wearables, physiological monitoring, data acquisition, validation/test engineering, verification/validation, Entwicklungsingenieur, Softwareentwickler Medizintechnik, Embedded Entwickler, Testingenieur, Junior Entwicklungsingenieur, Berufseinsteiger, Absolvent, Trainee, Forschungsassistent, Wissenschaftlicher Mitarbeiter and Doktorand/PhD plus relevant German synonyms.

Germany discovery should include BA broad Medizintechnik searches, recent engineering searches, German MedTech clusters such as Weltzentrum der Medizintechnik, employer clusters, regional clusters, university/research portals, all 15 named portals, other reputable boards/aggregators, direct employer portals and ATS systems.

## Europe coverage

Cover all EU member states plus Iceland, Liechtenstein, Norway, Switzerland, United Kingdom and other accessible European markets. Use local-language discovery, EURES/public-employment sources, EURAXESS, university/research portals, direct employers, ATS systems, MedTech ecosystems and reputable job boards.

A single run must **not** claim 100% vacancy recall. The fixed source/country/language matrix plus persistent historical discovery and re-verification are the controls against day-to-day search drift.

## Production publication

Update:

- `data/jobs.json`
- `data/reports.json`
- `data/research-status.json`

Keep the existing Europe MedTech Jobs UI, dynamic country filter, 90%+ CV-match filter and historical archive intact.

## Manual/on-demand research

For an immediate refresh, ask ChatGPT to run a fresh Europe-wide MedTech job search using these established research rules. The same web-research and GitHub-update approach should be used; do not reintroduce the API-based GitHub Actions workflow.
