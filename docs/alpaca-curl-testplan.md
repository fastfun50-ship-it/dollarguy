# Alpaca Basic — curl testplan (efter keys i env)

**Host:** `https://data.alpaca.markets` (markedsdata).  
**Ikke:** `https://paper-api.alpaca.markets/v2` (trading — M1 scanner bruger det ikke).

Sæt keys lokalt (aldrig i chat / git):

```bash
export ALPACA_API_KEY='…'          # ikke log værdien
export ALPACA_API_SECRET='…'
export H="APCA-API-KEY-ID: ${ALPACA_API_KEY}"
export S="APCA-API-SECRET-KEY: ${ALPACA_API_SECRET}"
```

## 1) SIP discovery — most-actives

```bash
curl -sS -H "$H" -H "$S" \
  "https://data.alpaca.markets/v1beta1/screener/stocks/most-actives?by=volume&top=20" \
  | head -c 400
```

Forvent: HTTP 200 + `most_actives[].symbol`.

## 2) SIP discovery — movers

```bash
curl -sS -H "$H" -H "$S" \
  "https://data.alpaca.markets/v1beta1/screener/stocks/movers?top=10" \
  | head -c 400
```

Forvent: HTTP 200 + `gainers` / `losers`.

## 3) IEX snapshots

```bash
SYM=AAPL   # eller første symbol fra (1)
curl -sS -H "$H" -H "$S" \
  "https://data.alpaca.markets/v2/stocks/snapshots?symbols=${SYM}&feed=iex" \
  | head -c 500
```

Forvent: HTTP 200 + `latestTrade` / `dailyBar` / `prevDailyBar`.

## 4) IEX 1-min bars

```bash
curl -sS -H "$H" -H "$S" \
  "https://data.alpaca.markets/v2/stocks/bars?symbols=${SYM}&timeframe=1Min&feed=iex&limit=30" \
  | head -c 500
```

Forvent: HTTP 200 + `bars.${SYM}[]` med `t,o,h,l,c,v`.

## App-env (Vercel Preview)

```
DATA_PROVIDER=alpaca
ALPACA_API_KEY=…
ALPACA_API_SECRET=…
# ALPACA_DATA_URL=https://data.alpaca.markets   # optional; paper-api ignored
```

Ingen `NEXT_PUBLIC_*` keys. Ingen ordreendpoints.

**Påstå ikke** LIVE-integration grøn før ovenstående returnerer 200 med rigtige felter + preview viser LIVE badge (ikke EXAMPLE).
