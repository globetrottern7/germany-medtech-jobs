# Europe MedTech Jobs — Data Schemas

## `data/jobs.json`

Top-level: `{ "jobs": [...] }`.

Core vacancy fields: `id`, `title`, `company`, `location`, `country`, `status`, `url`, `category`, `deadline`, `fresh`, `match`, `fit`, `gaps`.

Verification fields: `sourceType`, `sourceLayers`, `openVerified`, `evidence`, `confidence`, `workAuthorization`.

Context signals: `sponsorship` and `relocation`, each using `offered: yes|no|unclear` plus evidence where available.

Scoring: `scoreBreakdown` contains the fixed components: `technicalSkillFit/25`, `domainRelevance/15`, `educationRelevance/15`, `experienceCompatibility/10`, `languageFit/10`, `materialRequirements/15`, `roleAlignment/10`. `match` is the total 0–100 score. Authorization is a separate gate and does not compensate for a poor score.

Historical identity: `fingerprint` is the normalized combination of company + title + primary location + country. URL is not an identity key. Normalize case, punctuation/separators and whitespace and clearly equivalent employer legal suffixes. Reposts, board copies, changed URLs and changed posting dates do not become new/fresh vacancies when the underlying requisition is the same.

Freshness: a vacancy is Fresh only when its canonical fingerprint has never appeared in an archived report.

## Candidate-local tracker state

Candidate state must not be written to public `jobs.json`. The current static portal stores it in browser `localStorage` under `medtechJobTracker.v1`.

Fields: `status` (`new|wishlist|applied|interviewing|offer|rejected`), `statusDate`, `notes`, `connection` (`none|potential|known|contacted|referral`), `followUpDate`.

## `data/reports.json`

Top-level: `{ "reports": [...] }`.

Each report contains `date`, `activeJobs`, `freshJobs`, `previouslyListed`, `closingWithin7Days`, `jobIds`, `freshJobIds`, `excludedJobIds`, and research coverage metadata.

`activeJobs` is the published count after the hard 75% floor, not the raw discovery universe.

## `data/research-status.json`

Latest-run operational status, timestamp, methodology version, message, coverage metrics, limitations and errors when applicable.

## Publication thresholds

- `<75`: not displayed.
- `75–89`: Qualified Match.
- `90–100`: Strong Match.

Historical records without component subscores must not receive invented retrospective breakdowns.
