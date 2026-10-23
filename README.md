# DollarGuy

Paper trading scanner + backtest system.

## Stack
- Vercel
- Supabase (Postgres)
- IBKR Paper (data + orders)
- Domain: dollarguy.system117.dk

## Structure
- `lib/dataProvider.ts` — switchable data source
- `lib/signals.ts` — technical signals (toggleable)
- `lib/backtest.ts` — run tests on historical data
- `schema.sql` — Supabase tables for signals, runs, results

## Plan
1. Scanner + signals run in 09:35–10:35 ET window
2. Backtest uses historical API data (no self-recording)
3. Research bots can analyze results and suggest better signal combinations
4. Dashboard shows what is enabled and clear P&L per test

**Paper only.**
