# ARCHITECTURE — dollarguy

## Modules
| Module | Path | Role |
|---|---|---|
| UI scanner | `components/ScannerApp.tsx`, `app/page.tsx` | Candidate list, detail, alerts, status badges |
| BFF API | `app/api/scan`, `alerts`, `ticker/[sym]`, `health` | Server-side scan orchestration |
| Signal engine | `lib/signals/*` | Pure ORB / HOD / RVOL / RUN / gap |
| Market data | `lib/data/provider.ts`, `exampleUniverse.ts` | DATA_PROVIDER = market data (not broker) |
| Scanner orchestrator | `lib/scanner.ts` | Filters → signals → candidates → alerts |
| Session | `lib/session.ts` | PRE/RTH/AH/CLOSED America/New_York |
| Alerts | `lib/alerts/store.ts` | Append-only memory (+ DB when configured) |
| DB | `lib/db.ts`, `schema.sql` | Schema ready; loud if missing |
| Worker | `worker/stub.ts` | Always-on placeholder |
| Backtest | `app/backtest`, `lib/backtest.ts` | M2 placeholder only |

## Data flow (M1)
EXAMPLE provider (default) or live adapter (pending) → `runScan` → `/api/scan` → UI list/detail/alerts.

## If I change X, test Y
| Change | Test |
|---|---|
| signals/* | `tests/signals.test.ts` + chain integration |
| data/provider | chain + health mode badge |
| ScannerApp / API | `tests/chain.integration.test.ts` |
| session | `tests/session.test.ts` |

## Must not
- New Vercel project / new repo
- Silent fallback from LIVE failure to fake-as-live
- Treat IBKR as M1 primary market-data provider
