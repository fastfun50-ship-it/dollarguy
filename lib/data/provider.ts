/**
 * Market DATA provider abstraction (not broker).
 * DATA_PROVIDER selects market-data vendor: example | massive | alpaca
 * Default: example (no keys / no subscription yet).
 * Never silently fall back from LIVE to fake-as-live.
 */

import type { Bar, DataMode, FeedStatus } from '../types';
import { EXAMPLE_TICKERS, buildExampleBars, type ExampleTickerSeed } from './exampleUniverse';
import { createAlpacaProviderFromEnv } from './alpacaProvider';

export interface MarketSnapshot {
  symbol: string;
  name: string;
  last: number;
  prevClose: number;
  open0930: number;
  float: number;
  volume: number;
  avgDailyVol20d: number;
  avgSlot5m: number;
  bars: Bar[];
  seed?: ExampleTickerSeed;
}

export interface MarketDataProvider {
  mode: DataMode;
  feedStatus: FeedStatus;
  feedLabel: string;
  listUniverse(): Promise<MarketSnapshot[]>;
  getBars(symbol: string): Promise<Bar[]>;
}

export type DataProviderKind = 'example' | 'massive' | 'alpaca';

export function resolveDataProviderKind(): DataProviderKind {
  const raw = (process.env.DATA_PROVIDER || 'example').toLowerCase().trim();
  if (raw === 'massive' || raw === 'polygon') return 'massive';
  if (raw === 'alpaca') return 'alpaca';
  // ibkr is NOT a market-data provider for M1 — treat as misconfig → example + loud
  if (raw === 'ibkr') return 'example';
  return 'example';
}

export function hasVendorKeys(kind: DataProviderKind): boolean {
  if (kind === 'massive') {
    return Boolean(process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY);
  }
  if (kind === 'alpaca') {
    return Boolean(
      (process.env.ALPACA_API_KEY || '').trim() && (process.env.ALPACA_API_SECRET || '').trim()
    );
  }
  return false;
}

class ExampleProvider implements MarketDataProvider {
  mode: DataMode = 'EXAMPLE';
  feedStatus: FeedStatus = 'OK';
  feedLabel = 'EXAMPLE · simuleret';

  async listUniverse(): Promise<MarketSnapshot[]> {
    return EXAMPLE_TICKERS.map((seed) => {
      const bars = buildExampleBars(seed);
      const last = bars[bars.length - 1]?.c ?? seed.open0930;
      const volume = bars.reduce((s, b) => s + b.v, 0);
      return {
        symbol: seed.symbol,
        name: seed.name,
        last,
        prevClose: seed.prevClose,
        open0930: seed.open0930,
        float: seed.float,
        volume,
        avgDailyVol20d: seed.avgDailyVol20d,
        avgSlot5m: seed.avgSlot5m,
        bars,
        seed,
      };
    });
  }

  async getBars(symbol: string): Promise<Bar[]> {
    const seed = EXAMPLE_TICKERS.find((t) => t.symbol === symbol);
    if (!seed) return [];
    return buildExampleBars(seed);
  }
}

class LiveUnavailableProvider implements MarketDataProvider {
  mode: DataMode = 'LIVE';
  feedStatus: FeedStatus = 'NOT_CONFIGURED';
  feedLabel: string;
  private reason: string;

  constructor(kind: DataProviderKind, reason: string) {
    this.feedLabel = `${kind.toUpperCase()} · ikke konfigureret`;
    this.reason = reason;
  }

  async listUniverse(): Promise<MarketSnapshot[]> {
    throw new Error(this.reason);
  }

  async getBars(): Promise<Bar[]> {
    throw new Error(this.reason);
  }
}

/**
 * Resolve provider.
 * - No keys / DATA_PROVIDER=example → EXAMPLE (explicit).
 * - DATA_PROVIDER=massive|alpaca without keys → throws loudly (caller shows error), does NOT serve fake as live.
 * - DATA_PROVIDER=alpaca with keys → live Alpaca Basic adapter (IEX bars + SIP screener).
 * - DATA_PROVIDER=massive with keys → still pending (throws loud until Massive wired).
 */
export function getMarketDataProvider(): MarketDataProvider {
  const kind = resolveDataProviderKind();
  const forceExample =
    process.env.FORCE_EXAMPLE === '1' || process.env.FORCE_EXAMPLE === 'true';

  if (forceExample || kind === 'example') {
    return new ExampleProvider();
  }

  if (!hasVendorKeys(kind)) {
    return new LiveUnavailableProvider(
      kind,
      `DATA_PROVIDER=${kind} men vendor-nøgler mangler. Ingen live data. Sæt FORCE_EXAMPLE=1 for EXAMPLE-mode, eller tilføj nøgler.`
    );
  }

  if (kind === 'alpaca') {
    const alpaca = createAlpacaProviderFromEnv();
    if (!alpaca) {
      return new LiveUnavailableProvider(
        kind,
        'DATA_PROVIDER=alpaca: nøgler mangler efter check (ALPACA_API_KEY + ALPACA_API_SECRET).'
      );
    }
    return alpaca;
  }

  // Massive keys present but adapter not wired yet — fail loud, never fake-as-live
  return new LiveUnavailableProvider(
    kind,
    `DATA_PROVIDER=${kind} nøgler fundet, men live adapter er ikke implementeret endnu. Brug EXAMPLE eller DATA_PROVIDER=alpaca.`
  );
}

export function providerMeta(): {
  kind: DataProviderKind;
  mode: DataMode;
  keysPresent: boolean;
  note: string;
} {
  const kind = resolveDataProviderKind();
  if (kind === 'example' || process.env.FORCE_EXAMPLE === '1' || process.env.FORCE_EXAMPLE === 'true') {
    return {
      kind: 'example',
      mode: 'EXAMPLE',
      keysPresent: false,
      note: 'EXAMPLE mode — syntetiske tickere (EXMP/DEMO/…). Ikke live markedsdata.',
    };
  }
  const keys = hasVendorKeys(kind);
  if (kind === 'alpaca' && keys) {
    return {
      kind,
      mode: 'LIVE',
      keysPresent: true,
      note: 'Alpaca Basic LIVE — SIP screener (most-actives/movers) + IEX bars/snapshots. Ikke fuld consolidated tape. Float mangler i feed.',
    };
  }
  return {
    kind,
    mode: 'LIVE',
    keysPresent: keys,
    note: keys
      ? 'Keys present; live adapter pending for this vendor.'
      : 'Live requested but keys missing — will error, not fall back silently.',
  };
}
