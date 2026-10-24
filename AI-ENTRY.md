# AI-ENTRY — dollarguy

Repository: fastfun50-ship-it/dollarguy. Dokumenteret arbejdsgren: `preview/scanner-m1`. Verificér den faktiske checkout før skrivning; en gammel status starter ikke en gammel opgave.

Start i [fælles README](https://github.com/fastfun50-ship-it/system117-ai-standard/blob/main/README.md), læs eget botindeks og relevant egen læring. Den eneste fælles regelkilde er [STANDARD.md](https://github.com/fastfun50-ship-it/system117-ai-standard/blob/main/STANDARD.md). Fælles regler kopieres ikke hertil; de gælder fortsat.

## Læs ved projektstart
- [PROJECT](https://github.com/fastfun50-ship-it/dollarguy/blob/preview/scanner-m1/ai/PROJECT.md): mål, funktioner og afgrænsning.
- [STATUS](https://github.com/fastfun50-ship-it/dollarguy/blob/preview/scanner-m1/ai/STATUS.md): fremdrift, kendte fejl og næste skridt.
- [RULES](https://github.com/fastfun50-ship-it/dollarguy/blob/preview/scanner-m1/ai/RULES.md): projektsærkrav og udgivelsesgrænser.

## Læs efter opgavens behov
- [ARCHITECTURE](https://github.com/fastfun50-ship-it/dollarguy/blob/preview/scanner-m1/ai/ARCHITECTURE.md) ved kode eller dataflow.
- [TESTS](https://github.com/fastfun50-ship-it/dollarguy/blob/preview/scanner-m1/ai/TESTS.md) for kontroller af de berørte brugerforløb.
- Eksisterende AGENTS/CLAUDE-vejledning bevares for værktøjskrav. Godkendt design og billeder findes via projektets eksisterende dokumentation; opfind ikke en designsti.

<!-- Repo-specific hard stops -->
- No auto-trading / no live orders in M1.
- No silent fake-as-live when vendor keys missing.
- `DATA_PROVIDER` = market-data vendor (`example`|`massive`|`alpaca`), NOT broker. Default `example`.


## Dependencies (ARCHITECTURE)
- `lightweight-charts` (TradingView, Apache-2.0) — chart display only. Peter GO 2026-10-23. Attribution required in UI.

## Market data (M1)
- Default `DATA_PROVIDER=example` → EXAMPLE badge.
- `DATA_PROVIDER=alpaca` + `ALPACA_API_KEY` + `ALPACA_API_SECRET` → LIVE Alpaca Basic on `https://data.alpaca.markets` (SIP screener + IEX bars). Not paper-api trading host. Curl testplan: `docs/alpaca-curl-testplan.md`.
- Never put secrets in `NEXT_PUBLIC_*` or git.

