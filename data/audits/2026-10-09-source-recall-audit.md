# Source Recall and Zero-New-Opportunity Audit — 9 October 2026

## Executive finding

The 8 October result of zero fresh published opportunities is **not evidence that no suitable vacancies exist**. The audit found a source-execution and reporting-coverage problem: the report listed only six searched source groups, while the configured source universe is much larger. The run explicitly disclosed that coverage was selective. It must not be described as a full sweep of all configured sources.

## Evidence from the current source sweep

- Jobvector's German Medizintechnik category exposed hundreds of listings, but includes sales, service, management, senior and unrelated roles; a category count is not the eligible-candidate count.
- The German Federal Employment Agency search showed hundreds of Medizintechnik-engineer listings and newly published postings, again requiring role-by-role adjudication.
- EURAXESS exposed a recently posted Forschungszentrum Jülich PhD on scientific imaging. Its direct technical fit and candidate eligibility need full review; the current evidence is not enough to add it automatically.
- DLR vacancy 5649, “Medizininformatiker/in oder Informatiker/in mit biomedizinischem Schwerpunkt”, is a material near-match: official page explicitly accepts graduates and describes biosignal processing (ECG/EEG), sensors, software, medical monitoring and hardware/software validation. However, it requires very good German and English; candidate profile records German B1. It therefore fails the current language hard gate unless the employer confirms B1 is acceptable. It also requires eligibility for a German security review.
- B. Braun embedded C/C++ medical-device vacancy requires prior embedded-software development experience; it does not currently pass the zero-years gate.
- Ottobock embedded/mechatronics vacancy requires 5–8 years; correctly excluded.

## Root causes

1. **Configured sources are not the same as executed sources.** The Oct 8 report lists only a small subset of sources, not every configured portal/employer/ATS.
2. **The daily query-budget configuration is internally ambiguous.** It contains both `ats` and `ATS` entries and category budgets that sum beyond the stated `dailyTotal`; these numbers are not a reliable execution log and must not be presented as actual searches performed.
3. **Broad category counts are not candidate-fit counts.** Jobvector/StepStone/BA listings include experienced, senior, sales, service, clinical, management and unrelated roles.
4. **The strict profile gates materially narrow results.** Candidate profile is a fresh graduate with zero professional years and German B1; many postings require experience or very good/fluent German.
5. **The DLR near-match illustrates a language false-negative risk.** It should remain excluded under the documented gate, but logged as a near-match and followed up only if the employer's language requirement can be clarified.
6. **Run status needs precise wording.** An Oct 8 backfill must not imply the scheduled 17:00 Europe/Berlin automation ran. Reports must distinguish scheduled execution, manual backfill and partial source coverage.

## Required corrections

- Keep strict hard gates; do not lower them just to manufacture fresh listings.
- Log per-source status per run: searched, unavailable, not searched, result count, candidate leads, official verification outcome.
- Make the daily budget schema non-ambiguous and describe it as a planning budget unless the actual query ledger proves execution.
- Expand the actual sweep, not just the source registry: German and English title variants, graduate/zero-years terms, direct employer ATS, university/research, and the configured specialist/public boards.
- Record every promising lead and exclusion reason, especially experience, language, degree, work authorization, official-source status and duplicate status.
- Separate “no fresh vacancies passed the gates” from “no fresh vacancies exist.”
- Treat DLR vacancy 5649 as **near-match / language gate fail**, not a published opportunity. Official URL: https://jobs.dlr.de/job/Medizininformatikerin-oder-Informatikerin-mit-biomedizinischem-Schwerpunkt-%28wmd%29/5649-de_DE/

## Audit conclusion

The zero-new result is plausible under the strict candidate gates, but the completeness of the Oct 8 search is **not demonstrated**. The main defect is incomplete/unevidenced source execution and insufficient per-source coverage logging, not proof that the publication threshold is too strict.
