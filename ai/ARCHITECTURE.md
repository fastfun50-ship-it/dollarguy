# ARCHITECTURE — dollarguy

## Modules
| Module | Path | Role |
|---|---|---|
| UI scanner | `components/ScannerApp.tsx`, `PriceChart.tsx`, `app/page.tsx` | Candidate list, detail, alerts, status badges |
| Chart | `components/PriceChart.tsx` + `lightweight-charts` (Apache-2.0) | Candles + volume + VWAP/OR overlays; display only |
| BFF API | `app/api/scan`, `alerts`, `ticker/[sym]`, `health` | Server-side scan orchestration |
| Signal engine | `lib/signals/*` | Pure ORB / HOD / RVOL / RUN / gap |
| Market data | `lib/data/provider.ts`, `alpacaClient.ts`, `alpacaProvider.ts`, `exampleUniverse.ts` | DATA_PROVIDER = market data (not broker) |
| Scanner orchestrator | `lib/scanner.ts` | Filters → signals → candidates → alerts |
| Session | `lib/session.ts` | PRE/RTH/AH/CLOSED America/New_York |
| Alerts | `lib/alerts/store.ts` | Append-only memory (+ DB when configured) |
| DB | `lib/db.ts`, `schema.sql` | Schema ready; loud if missing |
| Worker | `worker/stub.ts` | Always-on placeholder |
| Backtest | `app/backtest`, `lib/backtest.ts` | M2 placeholder only |

## Data flow (M1)
- `DATA_PROVIDER=example` (default) → EXAMPLE provider → `runScan` → UI (pink EXAMPLE badge).
- `DATA_PROVIDER=alpaca` + `ALPACA_API_KEY`/`ALPACA_API_SECRET` → Alpaca Basic LIVE:
  - Discovery: SIP `most-actives` + `movers` on **`https://data.alpaca.markets`**
  - Bars/snapshots: IEX feed (not consolidated) — UI sky disclaimer
  - No trading / paper-api / orders
- Missing keys with live provider → loud `NOT_CONFIGURED` (empty list), never silent fake-as-live.

## If I change X, test Y
| Change | Test |
|---|---|
| signals/* | `tests/signals.test.ts` + chain integration |
| data/provider / alpaca* | `tests/alpaca.provider.test.ts` + chain + health mode badge |
| ScannerApp / API | `tests/chain.integration.test.ts` |
| session | `tests/session.test.ts` |

## Must not
- New Vercel project / new repo
- Silent fallback from LIVE failure to fake-as-live
- Treat IBKR or paper-api trading URL as M1 market-data host
- Order placement / paper-trading UI as working
