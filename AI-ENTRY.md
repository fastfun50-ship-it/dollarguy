# STOP BEFORE MODIFYING THIS REPOSITORY.

Repository: `fastfun50-ship-it/dollarguy` · Standard: [SYSTEM117 AI Development Standard v1.4](https://github.com/fastfun50-ship-it/system117-ai-standard/blob/main/STANDARD.md)

1. Read `/ai/PROJECT.md`.
2. Read `/ai/RULES.md`.
3. Determine affected modules using `/ai/ARCHITECTURE.md`.
4. Read the relevant regression requirements in `/ai/TESTS.md`.
5. Inspect the actual implementation before changing anything.
6. Make the smallest possible change.
7. Run the required tests.
8. If a regression occurs, the task is NOT complete.
9. Do not change architecture merely to solve a local problem.
10. Update status docs (`/ai/STATUS.md`) only where appropriate.

Before step 6, declare the EXPECTED CHANGE SCOPE (see `/ai/RULES.md`).
Docs and code disagree? STOP and report — code is the truth of the implementation, `/ai` is the map.
**Critical User Flow Gate:** build/lint/typecheck/isolated tests green ≠ DONE. Name the affected critical user flows (`/ai/TESTS.md`). A change to a data chain or a function across modules needs at least one automated integration/E2E test proving the whole chain from input to visible result - otherwise the status is **TEST GAP** (state exactly what is not verified), never DONE.
**Data Contract Gate:** when data is produced/imported in one place and consumed in another, the test must verify that producer and consumer use the same schema/data source. No parallel hard-coded demo data may hide a broken integration. DONE report format: `/ai/RULES.md` §2c.
**Data Source Gate (demo data realism):** never replace required real/external base data with synthetic data to reach a count or get a test green. State what is real vs synthetic and which source was used; on source failure fail loudly - never silently fall back to invented data. EXAMPLE mode is allowed only when clearly badged and never presented as LIVE.
**Fixed working branch (Git rule, mandatory - STANDARD.md §9b):** one fixed working/preview branch per project (named in `/ai/RULES.md` → "Deploy / branches"). All ordinary changes continue there. Never create a new branch automatically. Small, clear commits; failed change → `git revert`, never force-push. `main` = stable production; no automatic merges to `main` without Peter's approval.

<!-- Repo-specific hard stops -->
- No auto-trading / no live orders in M1.
- No silent fake-as-live when vendor keys missing.
- `DATA_PROVIDER` = market-data vendor (`example`|`massive`|`alpaca`), NOT broker. Default `example`.
