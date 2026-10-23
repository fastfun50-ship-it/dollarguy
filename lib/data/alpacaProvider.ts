/**
 * Alpaca Basic market-data provider for M1 scanner.
 * Discovery: SIP most-actives + movers.
 * Detail/bars: IEX (not consolidated tape) — UI must show disclaimer.
 * Float is NOT in Alpaca Basic → float=null (ukendt; never fake 0).
 * No order / trading API usage.
 */

import type { Bar } from '../types';
import { etSessionStartIso } from '../session';
import type { MarketDataProvider, MarketSnapshot } from './provider';
import {
  AlpacaMarketDataClient,
  createAlpacaClientFromEnv,
  type AlpacaBarRaw,
  type AlpacaSnapshotRaw,
  type FetchLike,
} from './alpacaClient';

const FEED_LABEL = 'ALPACA · IEX bars + SIP screener (begrænset)';

function mapBar(b: AlpacaBarRaw): Bar {
  return { t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v ?? 0 };
}

function lastPrice(snap: AlpacaSnapshotRaw): number {
  return (
    snap.latestTrade?.p ??
    snap.minuteBar?.c ??
    snap.dailyBar?.c ??
    snap.prevDailyBar?.c ??
    0
  );
}

function avgSlot5mFromBars(bars: Bar[]): number | null {
  const withVol = bars.filter((b) => b.v > 0);
  if (withVol.length < 5) return null; // cannot trust slot baseline from empty IEX volumes
  if (bars.length < 5) {
    const mean = withVol.reduce((s, b) => s + b.v, 0) / withVol.length;
    return mean > 0 ? mean * 5 : null;
  }
  const slots: number[] = [];
  for (let i = 0; i + 5 <= bars.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v += bars[i + j].v;
    if (v > 0) slots.push(v);
  }
  if (!slots.length) return null;
  return slots.reduce((a, b) => a + b, 0) / slots.length;
}

export class AlpacaProvider implements MarketDataProvider {
  mode = 'LIVE' as const;
  feedStatus = 'OK' as const;
  feedLabel = FEED_LABEL;
  private client: AlpacaMarketDataClient;
  private topDiscovery: number;
  private barLimit: number;

  constructor(client: AlpacaMarketDataClient, opts?: { topDiscovery?: number; barLimit?: number }) {
    this.client = client;
    this.topDiscovery = opts?.topDiscovery ?? 40;
    this.barLimit = opts?.barLimit ?? 1000;
  }

  async listUniverse(): Promise<MarketSnapshot[]> {
    let actives: { symbol: string }[] = [];
    let movers: { symbol: string }[] = [];
    try {
      [actives, movers] = await Promise.all([
        this.client.getMostActives(50, 'volume'),
        this.client.getMovers(20),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Alpaca discovery fejlede (loud): ${msg}`);
    }

    const seen = new Set<string>();
    const symbols: string[] = [];
    for (const row of [...movers, ...actives]) {
      const s = (row.symbol || '').toUpperCase();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      symbols.push(s);
      if (symbols.length >= this.topDiscovery) break;
    }

    if (!symbols.length) {
      throw new Error('Alpaca discovery returnerede 0 symbols (loud — ikke EXAMPLE-fallback).');
    }

    let snapshots: Record<string, AlpacaSnapshotRaw>;
    let barsBySym: Record<string, AlpacaBarRaw[]>;
    try {
      snapshots = await this.client.getSnapshots(symbols, 'iex');
      barsBySym = await this.client.getBars({
        symbols,
        timeframe: '1Min',
        feed: 'iex',
        limit: this.barLimit,
        start: etSessionStartIso(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Alpaca snapshots/bars fejlede (loud): ${msg}`);
    }

    const out: MarketSnapshot[] = [];
    for (const sym of symbols) {
      const snap = snapshots[sym];
      if (!snap) continue;
      const rawBars = barsBySym[sym] || [];
      const bars = rawBars.map(mapBar);
      const last = lastPrice(snap);
      if (!(last > 0)) continue;
      const prevClose = snap.prevDailyBar?.c ?? snap.dailyBar?.o ?? last;
      const open0930 = snap.dailyBar?.o ?? bars.find((b) => b.o > 0)?.o ?? last;
      const barVolSum = bars.reduce((s, b) => s + b.v, 0);
      const volume =
        snap.dailyBar?.v && snap.dailyBar.v > 0
          ? snap.dailyBar.v
          : barVolSum;
      // Basic has no true 20d ADV — prev day volume is a rough baseline when present.
      const prevVol = snap.prevDailyBar?.v ?? 0;
      const avgDailyVol20d = prevVol > 0 ? prevVol : null;
      const avgSlot5m = avgSlot5mFromBars(bars);

      out.push({
        symbol: sym,
        name: sym,
        last,
        prevClose,
        open0930,
        // Float not on Alpaca Basic — null = ukendt (never 0 stand-in).
        float: null,
        volume,
        avgDailyVol20d,
        avgSlot5m,
        bars,
      });
    }

    if (!out.length) {
      throw new Error('Alpaca snapshots mapped to 0 usable tickers (loud — ikke EXAMPLE-fallback).');
    }
    return out;
  }

  async getBars(symbol: string): Promise<Bar[]> {
    try {
      const raw = await this.client.getBarsOne(symbol.toUpperCase(), {
        timeframe: '1Min',
        feed: 'iex',
        limit: this.barLimit,
        start: etSessionStartIso(),
      });
      return raw.map(mapBar);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Alpaca getBars(${symbol}) fejlede (loud): ${msg}`);
    }
  }
}

export function createAlpacaProviderFromEnv(fetchFn?: FetchLike): AlpacaProvider | null {
  const client = createAlpacaClientFromEnv(fetchFn);
  if (!client) return null;
  return new AlpacaProvider(client);
}
