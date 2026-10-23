# TESTS — dollarguy

## Existing automated checks
| Check | Command | Status |
|---|---|---|
| Unit + integration (node:test) | `npm test` | required for M1 |
| Production build | `npm run build` | required before PR |

## Critical user flows
1. **M1 scan chain:** data → filters → candidate list → explanation → chart → alert history (same schema/source).
2. **Empty result:** no matches ≠ data error; UI shows empty state.
3. **Connection down:** feed=DOWN banner; no silent fake fill.
4. **EXAMPLE badge:** mode=EXAMPLE always visibly badged.
5. **Delayed badge:** when mode=DELAYED, large DELAYED badge (wired; live delayed pending vendor).
6. **Reload:** Genindlæs refreshes scan.
7. **Session phases:** PRE / RTH / AH / CLOSED from America/New_York.
8. **Backtest stub:** `/backtest` says M2 — no P&L numbers.

## Regression matrix
| Area changed | Must re-verify |
|---|---|
| signals/* | flow 1 |
| data/provider | flows 1, 3, 4 |
| ScannerApp | flows 1, 2, 4, 6 |
| session | flow 7 |

## TEST GAPs
- **Live market-data chain** not verified (no vendor keys / subscription). M1 ships EXAMPLE-only until Peter approves data purchase. Report as blocker, not DONE for live chain.
- Browser E2E (Playwright) not in M1 — API/integration covers chain; UI visually matched to Alma design manually when preview up.
