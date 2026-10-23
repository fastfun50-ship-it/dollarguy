# Alpaca Basic — API call budget (M1 scanner)

## Before (tip 64b4db0)

UI polled `/api/scan` every **8s**. Each scan: discovery (2) + snapshots (1) + **per-symbol bars ≤40** (concurrency 5).  
Ticker click: `listUniverse` + `runScan` + `getBars` again.  
Multi-tab ≈ N×.  
**Rough:** ≥40 bars / 8s ≈ **~300 bars-req/min** + screener → Basic **429**.

## After (this tip)

| Layer | Behavior |
|---|---|
| Universe cache | TTL **45s** + single-flight |
| Bars cache | TTL **45s** + in-flight dedupe per symbol |
| Bars concurrency | **2** |
| getJson | **429** → respect `Retry-After` (cap 60s), up to 4 attempts |
| UI poll | **20s** (30s when RATE_LIMITED/STALE) |
| Ticker | uses cached snap/bars; no nested `runScan` |

## Steady-state estimate (1 warm server instance, 1–3 tabs)

- Discovery+snapshots: **~1–2 / 45s** ≈ **3–4 / min**
- Bars refresh: **≤40 symbols / 45s** with concurrency 2 ≈ **~50–55 / min** peak on cold; **~0 / min** while TTL warm
- Ticker switches: **0 extra** Alpaca when cache warm

Cold start still bursts (~40 bars once); afterwards well under typical Basic thresholds. Partial 429 → keep last-good + `feed=RATE_LIMITED` / `STALE`.
