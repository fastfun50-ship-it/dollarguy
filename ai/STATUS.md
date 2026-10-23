# STATUS — dollarguy

- Branch: `preview/scanner-m1`
- M1: EXAMPLE scanner + signal engine + Alpaca Basic LIVE adapter + chart (lightweight-charts) + tests
- **Active Preview data source (when env set):** Alpaca Basic LIVE · SIP screener + IEX bars · ingen ordrer · float mangler
- Env (Preview only, server-side): `DATA_PROVIDER=alpaca`, `ALPACA_API_KEY`, `ALPACA_API_SECRET` — never `NEXT_PUBLIC_*` for secrets; no `FORCE_EXAMPLE` in Preview when LIVE intended
- Verify: `GET /api/health` → `mode=LIVE`, `provider=alpaca`, `keysPresent=true`, `dataSourceNote` includes Alpaca Basic LIVE
- Known limits: float not in Alpaca Basic; IEX ≠ consolidated RVOL; DB env empty; no Production; no order endpoints
- Not done: Massive adapter, always-on worker hosting, paper broker orders, backtest M2, production merge
