# DollarGuy

US stock momentum scanner (research). **No auto-trading.**

## M1
- Scanner UI (Danish) with mandatory **EXAMPLE DATA** badge when synthetic.
- Signal engine: ORB5 close-break, HOD (RTH + cooldown), rvol_5m default.
- Default `DATA_PROVIDER=example` (market data — not broker).
- Backtest route: comes in M2.

## Develop
```bash
npm install
npm test
npm run dev
```

## Env (names only)
- `DATA_PROVIDER` — `example` | `massive` | `alpaca` (default `example`)
- `FORCE_EXAMPLE=1` — force EXAMPLE even if other provider set
- `MASSIVE_API_KEY` / `POLYGON_API_KEY` — when Massive approved
- `ALPACA_API_KEY` + `ALPACA_API_SECRET` — when Alpaca data approved
- `DATABASE_URL` / `SUPABASE_DB_URL` / `POSTGRES_URL` — optional; else “DB not configured”

See `AI-ENTRY.md` and `/ai/*`.


## Chart library
- [`lightweight-charts`](https://www.npmjs.com/package/lightweight-charts) (TradingView) — **Apache-2.0**
- Charts are for **display only**; OHLC / VWAP / OR come from our market-data chain (`DATA_PROVIDER`, default EXAMPLE).
- Attribution: [TradingView](https://www.tradingview.com/) — see app footer + chart chrome link. See `node_modules/lightweight-charts/LICENSE`.
