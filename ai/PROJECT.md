# PROJECT — dollarguy

## Purpose
US stock momentum scanner for research / paper workflow. **Not** live auto-trading with real money.

## Users
Peter Nielsen (single-user SYSTEM117).

## M1 scope (locked 2026-10-23)
- Next.js UI on existing Vercel project + always-on worker stub + DB schema ready.
- Chain: market data (or explicit EXAMPLE) → documented filters/signals → ticker list → explanation → chart → alert history.
- Signals 1:1 (Alice): ORB_N=5 close-break, HOD RTH+cooldown, rvol_5m UI-default.
- UI 1:1 spirit (Alma): Danish copy, desktop table + detail, mobile-friendly, EXAMPLE badge mandatory when synthetic.
- Backtest route = “kommer i M2” — no functional P&L.
- No paper order placement in M1.

## Out of M1
Auto-trading, live broker orders, full always-on worker with vendor WS, halt handling (M2), backtest P&L.

## Integrations (planned)
- Market data: **Alpaca Basic** (Paper keys → `data.alpaca.markets`) wired for Preview when env set; Massive adapter still pending.
- DB: Supabase/Neon when `DATABASE_URL` present; else in-memory alerts + visible “DB not configured”.
- Worker: stub until keys/hosting decided.
