/**
 * Alpaca Basic market-data provider for M1 scanner.
 * Discovery: SIP most-actives + movers.
 * Detail/bars: IEX (not consolidated tape) — UI must show disclaimer.
 * Float is NOT in Alpaca Basic → float=null (ukendt; never fake 0).
 * No order / trading API usage.
 *
 * Caching: in-process universe TTL + single-flight; per-symbol bars TTL.
 * Partial failure keeps last-good universe; feedStatus → RATE_LIMITED / STALE.
 */

import type { Bar, FeedStatus } from '../types';
import { etSessionStartIso } from '../session';
import type { MarketDataProvider, MarketSnapshot } from './provider';
import {
  AlpacaMarketDataClient,
  createAlpacaClientFromEnv,
  isAlpacaRateLimit,
  type AlpacaBarRaw,
  type AlpacaSnapshotRaw,
  type FetchLike,
} from './alpacaClient';

const FEED_LABEL = 'ALPACA · IEX bars + SIP screener (begrænset)';
/** Universe refresh cadence — stops 8s UI poll from re-hitting Alpaca every time. */
export const UNIVERSE_TTL_MS = 45_000;
/** Per-symbol bars cache (also filled by listUniverse). */
export const BARS_TTL_MS = 45_000;

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

type CacheEntry<T> = { at: number; data: T };

export class AlpacaProvider implements MarketDataProvider {
  mode = 'LIVE' as const;
  feedStatus: FeedStatus = 'OK';
  feedLabel = FEED_LABEL;
  private client: AlpacaMarketDataClient;
  private topDiscovery: number;
  private barLimit: number;
  private universeCache: CacheEntry<MarketSnapshot[]> | null = null;
  private universeInflight: Promise<MarketSnapshot[]> | null = null;
  private barsCache = new Map<string, CacheEntry<Bar[]>>();

  constructor(client: AlpacaMarketDataClient, opts?: { topDiscovery?: number; barLimit?: number }) {
    this.client = client;
    this.topDiscovery = opts?.topDiscovery ?? 40;
    this.barLimit = opts?.barLimit ?? 1000;
  }

  /** Test / ops: drop in-memory caches. */
  clearCachesForTests(): void {
    this.universeCache = null;
    this.universeInflight = null;
    this.barsCache.clear();
    this.feedStatus = 'OK';
  }

  findCachedSnapshot(symbol: string): MarketSnapshot | undefined {
    const u = this.universeCache?.data;
    if (!u) return undefined;
    const sym = symbol.toUpperCase();
    return u.find((s) => s.symbol === sym);
  }

  async listUniverse(): Promise<MarketSnapshot[]> {
    const now = Date.now();
    if (this.universeCache && now - this.universeCache.at < UNIVERSE_TTL_MS) {
      if (this.feedStatus === 'RATE_LIMITED') {
        // still serving cache while rate-limited
        this.feedStatus = 'STALE';
      } else if (this.feedStatus !== 'STALE') {
        this.feedStatus = 'OK';
      }
      return this.universeCache.data;
    }
    if (this.universeInflight) return this.universeInflight;

    this.universeInflight = this.fetchUniverseFresh()
      .then((data) => {
        this.universeCache = { at: Date.now(), data };
        return data;
      })
      .catch((e) => {
        if (this.universeCache?.data?.length) {
          this.feedStatus = isAlpacaRateLimit(e) ? 'RATE_LIMITED' : 'STALE';
          return this.universeCache.data;
        }
        throw e;
      })
      .finally(() => {
        this.universeInflight = null;
      });

    return this.universeInflight;
  }

  private async fetchUniverseFresh(): Promise<MarketSnapshot[]> {
    let actives: { symbol: string }[] = [];
    let movers: { symbol: string }[] = [];
    try {
      [actives, movers] = await Promise.all([
        this.client.getMostActives(50, 'volume'),
        this.client.getMovers(20),
      ]);
    } catch (e) {
      if (isAlpacaRateLimit(e) && this.universeCache?.data?.length) {
        this.feedStatus = 'RATE_LIMITED';
        return this.universeCache.data;
      }
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
    try {
      snapshots = await this.client.getSnapshots(symbols, 'iex');
    } catch (e) {
      if (isAlpacaRateLimit(e) && this.universeCache?.data?.length) {
        this.feedStatus = 'RATE_LIMITED';
        return this.universeCache.data;
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Alpaca snapshots/bars fejlede (loud): ${msg}`);
    }

    const start = etSessionStartIso();
    const { bars: barsBySym, rateLimited, errors } = await this.client.getBars({
      symbols,
      timeframe: '1Min',
      feed: 'iex',
      limit: this.barLimit,
      start,
    });

    if (rateLimited) this.feedStatus = 'RATE_LIMITED';
    else if (Object.keys(errors).length) this.feedStatus = 'STALE';
    else this.feedStatus = 'OK';

    const out: MarketSnapshot[] = [];
    for (const sym of symbols) {
      const snap = snapshots[sym];
      if (!snap) continue;
      let rawBars = barsBySym[sym] || [];
      // Prefer prior cached bars if this symbol's fetch failed empty
      if (!rawBars.length && errors[sym]) {
        const cached = this.barsCache.get(sym);
        if (cached?.data?.length) rawBars = cached.data.map((b) => ({ ...b }));
      }
      const bars = rawBars.map(mapBar);
      if (bars.length) this.barsCache.set(sym, { at: Date.now(), data: bars });

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
      if (this.universeCache?.data?.length) {
        this.feedStatus = rateLimited ? 'RATE_LIMITED' : 'STALE';
        return this.universeCache.data;
      }
      throw new Error('Alpaca snapshots mapped to 0 usable tickers (loud — ikke EXAMPLE-fallback).');
    }
    return out;
  }

  async getBars(symbol: string): Promise<Bar[]> {
    const sym = symbol.toUpperCase();
    const now = Date.now();
    const cached = this.barsCache.get(sym);
    if (cached && now - cached.at < BARS_TTL_MS) {
      return cached.data;
    }
    // Prefer bars already on universe snapshot (same TTL window)
    const fromUniverse = this.findCachedSnapshot(sym);
    if (fromUniverse?.bars?.length && this.universeCache && now - this.universeCache.at < BARS_TTL_MS) {
      this.barsCache.set(sym, { at: this.universeCache.at, data: fromUniverse.bars });
      return fromUniverse.bars;
    }

    try {
      const raw = await this.client.getBarsOne(sym, {
        timeframe: '1Min',
        feed: 'iex',
        limit: this.barLimit,
        start: etSessionStartIso(),
      });
      const bars = raw.map(mapBar);
      this.barsCache.set(sym, { at: Date.now(), data: bars });
      return bars;
    } catch (e) {
      if (cached?.data?.length) {
        this.feedStatus = isAlpacaRateLimit(e) ? 'RATE_LIMITED' : 'STALE';
        return cached.data;
      }
      if (fromUniverse?.bars?.length) {
        this.feedStatus = isAlpacaRateLimit(e) ? 'RATE_LIMITED' : 'STALE';
        return fromUniverse.bars;
      }
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
