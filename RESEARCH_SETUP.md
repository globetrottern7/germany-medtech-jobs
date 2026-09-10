# Research Now setup

The portal's **Research Now** control uses a GitHub Actions workflow. The workflow performs fresh Germany-wide web research through the OpenAI Responses API, applies the strict 0-years/fresher rules, updates `data/jobs.json` and `data/reports.json`, and commits the result.

## One-time setup

1. Create an OpenAI API key in the OpenAI API platform.
2. In this GitHub repository open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named exactly:

   `OPENAI_API_KEY`

4. Paste the API key as the secret value.
5. Open **Actions → Research Now → Run workflow** once to test it.

The API key is never stored in the public website or repository files. The workflow reads it only from the GitHub Actions secret.

## Using Research Now

The public portal button opens the secure GitHub Actions control. From there click **Run workflow**. The workflow then performs a new search rather than simply reloading existing JSON.

The existing automated 5 PM German-time ChatGPT job-monitoring process remains separate, so a manual research run does not replace the scheduled daily report.

## Strict rules

The workflow excludes roles when current credible evidence indicates professional experience is required, unless the employer explicitly accepts fresh graduates/0 years. It also rejects stale/closed vacancies and preserves Fresh vs Previously Listed history.
