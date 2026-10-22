# Full Source Ledger Execution Gate — 22 October 2026

## Decision
User requirement: every user-requested search must attempt all 577 entries in the master source ledger, with a per-source execution record. Query budgets are planning metadata and cannot silently truncate the sweep.

## Repository finding
The current production configuration and 22 October report do not contain a 577-entry master ledger. The current report records 177 configured source entries, of which 48 had an attempt recorded and 129 were marked not_searched. The repository tree does not contain `state/source-ledger.json`. Therefore the 577-source requirement cannot honestly be marked implemented end-to-end yet: the source manifest itself must first be recovered/restored into the repository.

## Controls committed
- Added `searchExecutionPolicy` to `state/config.json`.
- Set the expected master-ledger size to 577 and required manifest path to `state/source-ledger.json`.
- Explicitly prohibited the 60-query planning budget from limiting source execution.
- Required per-source status, method, query/endpoint, timestamp, result count, leads, official-verification outcome and blocker evidence.
- Defined fail-closed behavior: missing manifest means `SOURCE_LEDGER_MISSING`; any `not_searched` entry prevents a full-coverage claim.
- Preserved candidate eligibility gates; no threshold relaxation to inflate fresh counts.
- Separated research execution, publication reconciliation and Pages deployment as independent success criteria.

## Important limitation
These configuration controls do not themselves perform 577 searches. The active repository Pages workflow only validates and deploys static files; it is not a research runner. The complete 577-entry manifest and an execution-capable search runner must be restored/connected before the system can guarantee a complete 577-source sweep on every request. Until then, reports must say coverage is partial or the source ledger is missing.
