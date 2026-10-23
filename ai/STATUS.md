# STATUS — dollarguy

- Branch: `preview/scanner-m1`
- M1: EXAMPLE scanner + signal engine + Alpaca Basic LIVE adapter (needs keys in Preview env) + tests + PR
- Blockers: Alpaca keys must be set by Peter/Mira in Vercel Preview (`DATA_PROVIDER=alpaca`, `ALPACA_API_KEY`, `ALPACA_API_SECRET`); live curl not run from agent (no keys in chat); Vercel createDeployments may be disabled (manual preview); DB env empty; float not in Alpaca Basic; IEX ≠ consolidated RVOL
- Not done: Massive adapter, always-on worker hosting, paper broker orders, backtest M2, production merge
