# STATUS — dollarguy

- Branch: `preview/scanner-m1`
- **Alpaca Basic LIVE verificeret** (health+scan). Data: SIP screener + IEX bars · ingen ordrer · float mangler → UI «ukendt»
- **Bars fix:** per-symbol `getBarsOne` + `start=09:30 ET` + pagination (multi-symbol limit starved BOLT behind AAPL)
- Chart: fitContent/setVisibleLogicalRange after load/ticker/resize; empty states (loading / API-fejl / ingen IEX-minutbarer)
- Known: RVOL/HOD depend on IEX minute `v`; no Production; no order endpoints
