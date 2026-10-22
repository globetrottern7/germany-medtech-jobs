# Pipeline, Source Recall and Publication Audit — 22 October 2026

## Executive finding

**Coverage grade: PARTIAL. The user's concern is valid.** The strongest confirmed operational failure is that the ChatGPT automations responsible for research and recovery were disabled. The GitHub Actions workflow in this repository only validates and deploys static files; it does not discover jobs, search ATS feeds, adjudicate vacancies, or write daily reports.

No normal daily report was published for 19–21 October. The latest prior report was dated 18 October. A successful Pages deployment therefore did not mean that research had run or that the vacancy database was current.

## 1. Pipeline and automation checks

- `.github/workflows/pages.yml` contains a validation job and a Pages deployment job only.
- `Daily Europe MedTech Jobs`, `Daily Europe MedTech Jobs v2`, and `MedTech Run Check & Fix` automations were disabled at audit time.
- `data/daily-history.json` had no normal entries for 19–21 October.
- `data/research-status.json` still reflected the 9 October source-execution audit.
- A report-type mismatch allowed cross-file validation to be skipped: the validator checked only `reportType === "normal daily"`, while the report used `normal daily production refresh`. The validator now recognizes normal daily production-refresh variants.
- The site’s empty state hard-coded “Five doctoral/research opportunities”; this has been changed to generic text.

## 2. Search logic and gates

The repository still uses `EUROPE-MEDTECH-v6`:
- 75% minimum match; 90% strong-match threshold.
- Hard gates: current/open status, zero-years eligibility, degree fit, language feasibility, work authorization feasibility, technical fit, official source verification, and deduplication.
- Germany-first weighting and a separate research/PhD category.
- Employer/ATS/university/government source verification is required for publication; job boards are discovery sources.
- No evidence found that the score threshold or zero-years gate was tightened during the recent slump.

The strict gates explain some exclusions, but they do not explain the missing daily reports or missing source-execution evidence.

## 3. Official-source checks on 22 October

| Source / vacancy | Evidence and decision |
|---|---|
| Novanta Workday — Junior Test Engineer, Berlin | Current official Workday result shows Apply and Posted 4 Days Ago; explicit recent-graduate and little-to-no-experience language. Keep active at 87%. Language level unstated; individual work authorization remains to be confirmed. |
| Max Planck School of Biomedical AI | Official page live; deadline 1 December 2026. Keep research/PhD active at 80%. |
| ETH Zürich — machine-perfusion platforms PhD | Official vacancy live; MSc Biomedical Engineering accepted, fluent English required. Keep active at 90%; Swiss work authorization is separate. |
| TU/e — contrast ultrasound imaging PhD | Official Varbi application route accessible; prior official posting gives 6 November deadline. Keep active at 86%; verify direct ultrasound/physics-modelling depth. |
| University Hospital Tübingen — quantitative multi-tracer PET PhD | Official page live; deadline 31 October; Biomedical Engineering, Python/MATLAB and excellent English accepted. Keep active at 90%; check MSCA mobility rule. |
| Helmholtz München — optoacoustic tomography PhD | Official employer vacancy URL returns HTTP 410 Gone. Remove from active publication. |
| Stryker — R&D Biomedical/Mechanical Graduate Programme, Cork | Official page live; deadline Friday 24 October; 2.1 or equivalent required; relocation No. Keep provisional pending grade equivalence and Ireland work authorization. |
| Edwards Lifesciences — Clinical Graduate Program, Germany | Official page posted 5 days ago; Biomedical Engineering accepted; April 2027 start. Provisional because a valid European driving licence recognized in Germany is required and candidate status is unknown; proficiency level for the additional European language is unspecified. |
| Philips — Test Development Engineer, Böblingen | Search index surfaced a result, but the official page opened to “no jobs that match your search.” The description also asks for experience in electronics/hardware testing and effective German and English. Do not publish. |
| BIOTRONIK — Software Engineer Test, Berlin | Job-board result says applications are no longer accepted; asks for software-development/test-automation experience and confident German/English. Do not publish. |
| DLR — biomedical informatics / biosignal software, Cologne | Official page is current and highly relevant to ECG/EEG, sensors, Python and C++, but requires very good German and English. Candidate German B1 fails the documented language gate. Exclude. |
| B. Braun and Dräger career pages | Checked for graduate/engineering routes; surfaced items were mainly student internships/theses or did not have enough evidence to pass zero-years and language gates. |

## 4. Why the visible count fell

1. **Research automation was disabled.** This is the primary explanation for missing 19–21 October reports.
2. **Pages CI is deployment-only.** A green deploy proves static files can publish, not that a search ran.
3. **The inventory was stale.** Rechecking found one listed research vacancy now returning 410 Gone.
4. **Source registry is not source execution.** The repository contains a broad portal/employer registry, but no per-source ledger proves every configured source was searched in each recent run.
5. **Some indexed results fail current/open, experience or language gates.** Philips was not available on the official page; BIOTRONIK was closed; DLR requires very good German.
6. **Publication validation had a report-type bypass.** Corrected in this recovery.

## 5. Source universe and coverage limitation

The configured source universe includes the 15-portal Germany baseline (Indeed, LinkedIn Jobs, XING, StepStone, Jobware, Monster, meinestadt.de, stellenanzeigen.de, Yourfirm, Kimeta, Jooble, Jobvector, Absolventa, JobTeaser and Stellenwerk), public sources (Bundesagentur für Arbeit, EURES, EURAXESS and public-sector boards), research institutions/university hospitals, regional MedTech clusters, conformity-assessment bodies, recruiters and direct employer ATS platforms.

**This audit does not claim that every configured source was directly searched on 22 October.** This was a targeted current-source sweep. Every future run must record per source: SEARCHED / UNAVAILABLE / NOT_SEARCHED, discovery count, candidate leads, official verification outcome, and exclusion reason. A query budget is a plan, not execution evidence.

## 6. Publication result for 22 October

- **5 active opportunities**
  - Typical employment: **1** — Novanta Junior Test Engineer, Berlin (87%).
  - Research/PhD: **4** — Max Planck BMAI (80%), ETH Zürich (90%), TU/e (86%), University Hospital Tübingen (90%).
- **Fresh opportunities: 0** — all five were previously published; no newly discovered role passed every hard gate in this targeted sweep.
- **Provisional findings: 3** — Stryker graduate programme, Edwards clinical graduate programme, Söring hardware/lifecycle.
- **Removed:** Helmholtz München PhD (official URL returned 410 Gone).
- **Coverage:** PARTIAL, not full-universe exhaustion.

## 7. Required ongoing controls

1. Enable exactly one daily research automation and one 17:20 recovery/check automation; avoid duplicate scheduled runs.
2. Publish the dated report, update `data/reports.json`, `data/daily-history.json`, and persistent vacancy/posting/fingerprint state on every run.
3. Record source execution evidence for the full mandatory Germany baseline; explicitly mark unavailable/not-searched sources.
4. Reverify all active postings against official sources within 72 hours.
5. Run false-negative searches across validation/test, embedded C/C++, biosignal processing, sensor interfaces, clinical applications, regulatory/conformity assessment, and graduate/trainee titles.
6. Do not lower the zero-years, degree/technical fit, language, official-source, open-status or country-specific work-authorization gates to inflate counts.
7. The report is not considered live until the GitHub Pages deployment for the current commit succeeds.
