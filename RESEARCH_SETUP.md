# Research setup

The production research path now uses the **same approach as the earlier Germany search**: ChatGPT performs the web research directly, verifies the underlying vacancy sources, compares the results with the historical archive, and writes the verified Europe-wide report directly to this GitHub repository.

## Production architecture

`ChatGPT web search → source verification → strict adjudication → historical comparison → GitHub update`

The daily automation **Daily Europe MedTech Jobs** runs at 5 PM Europe/Berlin time. It searches Germany first and then the wider European MedTech/health-tech market.

## API credits are not required for the research path

This production workflow does **not** depend on the OpenAI API, `OPENAI_API_KEY`, or GitHub Actions to perform the research. The earlier GitHub Actions/OpenAI API implementation has been removed from the production path.

Therefore, an OpenAI API credit balance is not a prerequisite for the scheduled job research.

## Research rules

- Germany first, followed by Europe-wide coverage.
- Prefer official employer, ATS, university/research and other primary sources.
- Use search results/job boards for discovery, then verify the underlying vacancy whenever possible.
- Strictly filter for fresh-graduate/0-years suitability.
- Preserve Fresh vs Previously Listed history using vacancy identity rather than URL alone.
- Verify that vacancies are currently open before publishing them.
- Assess work authorization separately by country; do not assume a German residence status automatically grants work rights elsewhere in Europe.
- Preserve the existing Europe MedTech Jobs UI, country filter, 90%+ CV-match filter and historical archive.
- Never publish candidate personal identifiers.

## Manual/on-demand research

For an immediate refresh, ask ChatGPT to run a fresh Europe-wide MedTech job search using the established research rules. The same web-research and GitHub-update approach should be used; do not reintroduce the API-based GitHub Actions workflow.
