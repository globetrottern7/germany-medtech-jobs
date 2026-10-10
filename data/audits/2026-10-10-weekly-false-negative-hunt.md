# Weekly False-Negative Hunt — 10 October 2026

## Executive result

**Coverage grade: PARTIAL.** The formal publication thresholds reviewed from v5 (7 October) to v6 (8–10 October) did not materially tighten. The 7 October change expanded the source registry and raised the planned query budget from 40 to 60 units; the 9 October changes corrected source naming and query-budget semantics and required a source execution ledger. The recent zero-new results are therefore not explained by a demonstrated change to the score or hard gates.

This hunt surfaced additional near-matches, but **zero newly discovered vacancies were promoted into the normal published job set**. One live German MedTech role is held as a technical-evidence near-match, not a qualified listing. The search is materially broader than the 10 October daily sweep, but not every configured portal was directly inspected; this audit does not claim exhaustive market coverage.

## Criteria-diff findings

| Control | Last-week/current comparison | Finding |
|---|---|---|
| Minimum score | 75/100 | No change found |
| Strong-match threshold | 90/100 | No change found |
| Zero professional years | Hard gate; graduate/zero-year roles potentially eligible | No change found |
| Language | One CEFR level below or qualitative fluency gap normally fails without employer confirmation | No change found |
| Technical/degree fit | Hard gates | No change found |
| Official vacancy verification | Required; boards are discovery-only | No change found |
| Freshness/deduplication | Stable vacancy fingerprint; reposts do not become fresh | No change found |
| Discovery universe | Expanded 7 October; corrected source labels 9 October | Changed/additive |
| Query budget | 40 to 60 planned units; corrected on 9 October | Planning target only, not execution evidence |
| Execution logging | Per-source ledger added 9 October | Process-control change, not an eligibility gate |

Relevant repository changes:
- [7 October source expansion](https://github.com/globetrottern7/germany-medtech-jobs/commit/0bb6b63e4eb92e2a52ba7085f60b452256c24f97)
- [9 October source naming correction](https://github.com/globetrottern7/germany-medtech-jobs/commit/53835c89088cd20dbf504cc8912aceea2dc1bbab)
- [9 October budget and execution-ledger correction](https://github.com/globetrottern7/germany-medtech-jobs/commit/79a6bf1807997aaca66551f39fdf5b3e89ac978a)

## Source execution record

This was an indexed web-discovery and selected official-page verification exercise, not a direct authenticated crawl of every job board.

| Source/source family | Method/status | Outcome |
|---|---|---|
| Bundesagentur für Arbeit | Search results plus selected vacancy-detail checks | Broad category returns many roles; sampled inomed role requires 2 years and very good German; sampled Akkodis role requires 5 years |
| StepStone | Indexed search attempted | MedCom C/C++ medical-imaging role surfaced; requires fluent German/English |
| Jobware | Indexed search attempted | Brunel graduate role resurfaced; same near-match as prior day, not a new canonical vacancy |
| LinkedIn Jobs | Indexed search attempted | Brunel graduate role resurfaced; duplicate/re-discovery, not fresh |
| Jobvector | Category and signal-processing queries | GE Healthcare C++ ultrasound role surfaced; official GE career pages reported the corresponding role filled |
| MedTech-Jobs.de | Specialist-board indexed search | Results included old 2024/2025 postings; not counted as fresh |
| Indeed | Biomedical signal-processing query | ZEISS result required current Master's enrolment; not eligible for a fresh graduate |
| Yourfirm, Kimeta, Jooble, JobTeaser, Stellenwerk, Monster, stellenanzeigen.de | Indexed web queries attempted; not direct portal validation | No additional verified, gate-passing vacancy surfaced in returned results; direct source coverage remains incomplete |
| Life Science Nord | Regional cluster job-board page checked | Söring and mo:re leads surfaced; see adjudication below |
| Söring official careers | Official employer vacancy checked | Live Hardware & Lifecycle role; held for missing core electronics evidence |
| Erbe official careers | Official employer listing and role detail checked | Software role is live and technically relevant, but requires very good German |
| MedCom official careers | Official careers page checked | General open applications offered; exact C/C++ vacancy was not found on the employer's own careers page |
| GE HealthCare official careers | Official job result checked | Search result said the relevant Zipf Software Engineer vacancy was filled |
| Fraunhofer official careers | Official page checked | Medical Imaging and Digital Health result was a Master's thesis, requiring student status |
| EURAXESS / official research links | Search and selected offer-detail checks | Jülich, TU Delft, Radboudumc and EMBL leads reviewed; none promoted as a normal listing under the current technical-fit/experience/freshness rules |
| Siemens Healthineers, Philips, ZEISS, Brainlab and selected regional/regulatory queries | Indexed employer/source queries attempted | No additional official, gate-passing lead verified in the results returned; not evidence that every employer career page was directly searched |

## New and re-surfaced leads

### 1. Söring GmbH — Entwicklungsingenieur/in Hardware & Lifecycle (m/w/d), Quickborn

- Official vacancy: https://bewerbung.soering.com/de?id=8d976b
- Status: `PROVISIONAL_NEEDS_TECHNICAL_EVIDENCE`; **not counted as a qualified or published vacancy**.
- Positive evidence: Medical-device R&D, embedded-adjacent work, troubleshooting, test fixtures, verification/validation; Arduino, Python and microcontrollers are listed as helpful. The candidate profile includes Biomedical Engineering, C/C++, Arduino, sensor interfacing and validation projects.
- Gap: the role requires solid electronics fundamentals, schematic-reading ability and safe use of bench measurement equipment (e.g. oscilloscope/lab power supply). These skills are not evidenced in the stored candidate profile. “Ideally some years of experience” is phrased as preferred rather than a hard minimum, but the employer categorizes the role as experienced.
- Decision: do not promote until the core electronics/measurement fit can be evidenced. No language requirement was stated on the checked vacancy; work authorization remains a separate Germany-specific verification item.

### 2. Erbe Elektromedizin — Softwareentwickler für medizinische Geräte, Tübingen

- Official careers: https://de.erbegroup.com/de-de/karriere/jobs/
- Role detail: https://be.erbegroup.com/be-nl/jobs/detail/softwareentwickler-fuer-medizinische-geraete-m-w-d/
- Strong technical near-match: C++/Qt or Rust, medical-device software, documentation, reviews and unit/integration/system tests; only first practical software-development experience is requested and IEC 62304 is advantageous rather than mandatory.
- Exclusion: the posting asks for **very good German**; the profile records German B1. Under the existing language rule, hold unless the employer confirms B1 is accepted.

### 3. MedCom GmbH — Software-Entwickler/in C/C++ Medizinische Bildverarbeitung, Darmstadt

- Discovery result: https://www.stepstone.de/stellenangebote--Software-Entwickler-in-C-C-Medizinische-Bildverarbeitung-m-w-d-Darmstadt-Medcom-Gesellschaft-fuer-medizinische-Bildverarbeitung-mbH--14548463-inline.html
- Employer careers page: https://www.medcom-online.de/careers/
- Positive: the listing explicitly welcomes candidates seeking an entry into software development and aligns with C/C++ and medical image processing.
- Exclusion/hold: the listing asks for fluent German and English; German B1 does not pass. The employer's own careers page did not list this exact role and instead invites open applications, so the exact vacancy also lacks primary-source confirmation.

### 4. TU Delft — PhD Decision-making Under Uncertainty for Emerging Orphan and Breakthrough Medical Devices

- Offer: https://euraxess.ec.europa.eu/jobs/469600
- Deadline shown: 29 October 2026.
- Biomedical Engineering MSc is an accepted background; English is required and Dutch is optional. Prior medical-device regulatory expertise is advantageous, not mandatory.
- Hold below publication threshold: the core work is regulatory decision-making, policy, stakeholder interviews and research-methodology/writing. The candidate profile does not demonstrate sufficient policy/stakeholder research fit to justify a 75+ score. Netherlands work authorization must be checked separately if the role is reconsidered.

### 5. Forschungszentrum Jülich — PhD, Representation and Active Learning for Multi-Scale Scientific Imaging

- Offer: https://euraxess.ec.europa.eu/jobs/470258
- Exclusion: the role explicitly asks for a solid machine-learning/computer-vision background and Python frameworks such as PyTorch/TensorFlow. Those skills are not established in the candidate profile.

### 6. mo:re GmbH — Robotics Workflow Software Developer in Lab Automation, Hamburg

- Source: https://www.lifesciencenord.de/de/karriere/jobboerse/detail/robotics-workflow-software-developer-in-lab-automation-m-f-d.html
- Exclusion: minimum five years of professional software-development experience and German/English at C1; the candidate has zero professional years and German B1.

### 7. Other exclusions and duplicate checks

- Brunel Young Professional / Absolvent Medizintechnik: surfaced again through BA/Jobware/LinkedIn. This is a re-discovery/repost of the previously reviewed vacancy, not a new canonical job. It remains held under the secure-German/English requirement.
- inomed Medizintechnik developer: at least two years' technical product-development experience and very good German.
- Akkodis (Senior) Development Engineer: at least five years of medical-device development/industrialisation experience.
- Fraunhofer Medical Imaging and Digital Health: Master's thesis; student status required.
- ZEISS biomedical signal-processing result: current Master's enrolment required.
- GE HealthCare Zipf C++ Software Engineer: official career search result indicated the role was filled; aggregator copy was not treated as live.

## Root-cause conclusion

The criteria-diff does **not** support the theory that the 75-point score or the formal hard gates were tightened in the last week. The evidence supports two operational issues:

1. The 7 October source expansion was not matched by demonstrably complete daily/weekly execution. Recent reports searched selected subsets.
2. Search results contain plausible technical near-matches that fail a specific language, experience, student-status, source-verification or technical-evidence gate. Those exclusions explain some zeros, but do not prove that the entire market has no suitable vacancies.

## Corrective action recorded

The production config and research setup now require:
- an individual status for each mandatory baseline source;
- explicit distinction between direct official-page checks and indexed search attempts;
- a `FULL/PARTIAL/MISSED` coverage grade;
- no “maximum exhaustion” claim without a complete source ledger;
- zero-result wording scoped to the sources actually searched when coverage is partial;
- unchanged candidate-specific publication gates.

**Result:** 0 newly qualified jobs promoted; 1 technical-evidence provisional near-match; several near-matches explicitly excluded/held. Coverage remains PARTIAL, so a market-wide “no opportunities exist” conclusion is not supported.
