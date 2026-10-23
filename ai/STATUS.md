# STATUS — dollarguy

- Branch: `preview/scanner-m1`
- **Alpaca Basic LIVE** — SIP screener + IEX bars; ingen ordrer; float = ukendt
- Bars: per-symbol + RTH start + pagination (kept)
- **Rate-limit:** universe/bars TTL 45s, single-flight, bars concurrency 2, 429 Retry-After, last-good + RATE_LIMITED/STALE UI
- UI poll 20s (30s when limited); empty list ≠ «Ingen tickers matcher» under rate limit
- See `docs/alpaca-rate-budget.md`
- No Production; no EXAMPLE-fallback as live
