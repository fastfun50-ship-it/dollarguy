# RULES — dollarguy

## 1. SYSTEM117 shared rules
Full text: https://github.com/fastfun50-ship-it/system117-ai-standard/blob/main/STANDARD.md (v1.4)
- Roles · Critical User Flow Gate · Data Contract Gate · Data Source Gate · DONE report · Smallest Change · No Architecture Drift · No force-push.

## 2. EXPECTED CHANGE SCOPE (mandatory)
Declare before implementing. If diff goes well outside: STOP and reassess.

## 2a–2d
Follow STANDARD.md §2a/2b/2c and DONE report in shared RULES template.

## 3. Repo-specific rules
- **EXAMPLE vs LIVE:** EXAMPLE must be impossible to confuse with LIVE (pink badge + banner). Never serve synthetic as live.
- **DATA_PROVIDER:** market-data vendor only (`example` default, `massive`, `alpaca`). Not broker. IBKR ≠ M1 market data.
- **No paper-order UI as working** in M1. No faux live orders / fake P&L.
- **No auto-trading.**
- Neutral commit messages (Vercel may show them as deploy names) — no external system names in commit-msg.
- Secrets only in env; never in git/frontend.

## 4. Deploy / branches
- **Fixed working/preview branch:** `preview/scanner-m1`
- **Production:** `main` — merge only with Peter's explicit yes.
- No automatic new branches. No force-push. Revert with `git revert`.
- Vercel `createDeployments` may be DISABLED — use manual preview deploy when needed.
- Production domain may be unset; report `*.vercel.app` / preview URL.

## 5. ARCHITECTURE/PRODUCT DECISION REQUIRED
- Buying Massive/Alpaca (or any paid data)
- Connecting custom domain
- Enabling production deploy / merge to main
- Changing primary data vendor architecture
