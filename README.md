# Europe MedTech Jobs

Static job-intelligence portal (GitHub Pages) for a fresh M.Sc. Biomedical Engineering graduate, with Germany-first coverage.

- `index.html` — portal (jobs, Research & PhD, companies, map, tracker, CSV export)
- `stats.html` — publication history, unique-opportunity statistics and the automated discovery queue
- `data/` — published research data (see `DATA_SCHEMAS.md`)
- `state/` — persistent identity registry, exclusions, review queue and configuration
- `PRODUCTION_BASELINE.md`, `RESEARCH_SETUP.md` — methodology contract

## Automation

`.github/workflows/daily-research.yml` runs `scripts/daily-run.js` every day at 17:00 Europe/Berlin and on manual dispatch. It:

1. records missed run dates explicitly (no counts are invented);
2. expires roles whose deadline passed and link-checks active/provisional official URLs (HTTP 404/410 or "no longer available" text → closed);
3. queries public job APIs configured in `state/automation.json` (Bundesagentur für Arbeit Jobsuche, Arbeitnow, and any employer ATS boards you add: Greenhouse, Lever, SmartRecruiters, Personio, Workday);
4. deduplicates against the vacancy registry and pre-screens leads deterministically (seniority, student-only roles, 1+ years, German above B1, no MedTech signal);
5. optionally adjudicates queued leads with an LLM (off by default) — every hard gate is enforced in code and the score must be ≥75;
6. writes the daily report, index, history and status files, runs `scripts/validate-publication.js`, commits to `main` and deploys Pages.

Leads that pass pre-screening land in `state/leads.jsonl` and on the stats page as an **unverified** queue. They are never published without passing every gate.

### Running locally

```bash
node --test scripts/test/*.test.js
node scripts/daily-run.js --dry-run
node scripts/daily-run.js --offline --date 2026-11-24 --force
node scripts/validate-publication.js
```

### Adding an employer ATS board

Confirm the board identifier on the employer's official careers page, then copy the matching template from `atsExamples` in `state/automation.json` into `sources.ats`.

### Enabling LLM adjudication (optional)

Set `adjudication.enabled` to `true` in `state/automation.json` and add an `OPENAI_API_KEY` repository secret (Settings → Secrets and variables → Actions). `OPENAI_MODEL` can override the configured model. Without both, leads simply wait in the review queue.

### Repository settings required

- Settings → Actions → General → Workflow permissions: **Read and write** (the run commits to `main`).
- If `main` is protected, allow `github-actions[bot]` to push, or the commit step will fail.
- Settings → Pages → Source: **GitHub Actions**.
