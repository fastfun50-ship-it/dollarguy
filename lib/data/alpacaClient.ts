/**
 * Alpaca Market Data API client (Basic / IEX + SIP screener).
 * Host: https://data.alpaca.markets — NOT paper-api (trading).
 * No order endpoints. Fetch is injectable for unit tests (no live HTTP required).
 *
 * Bars: always **per-symbol** + pagination. Multi-symbol `/v2/stocks/bars` with a
 * shared limit starves thin names when AAPL fills page 1 (Mira coverage 2026-10-23).
 */

import { etSessionStartIso } from '../session';

export const ALPACA_DATA_HOST_DEFAULT = 'https://data.alpaca.markets';

export type FetchLike = typeof fetch;

export interface AlpacaClientConfig {
  apiKey: string;
  apiSecret: string;
  /** Market-data host only. Default https://data.alpaca.markets */
  dataBaseUrl?: string;
  fetchFn?: FetchLike;
}

export interface AlpacaBarRaw {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n?: number;
  vw?: number;
}

export interface AlpacaSnapshotRaw {
  latestTrade?: { p?: number; t?: string };
  latestQuote?: { ap?: number; bp?: number };
  minuteBar?: AlpacaBarRaw;
  dailyBar?: AlpacaBarRaw;
  prevDailyBar?: AlpacaBarRaw;
}

export class AlpacaHttpError extends Error {
  status: number;
  path: string;
  constructor(status: number, path: string, body: string) {
    super(`Alpaca ${status} ${path}: ${body.slice(0, 200)}`);
    this.status = status;
    this.path = path;
    this.name = 'AlpacaHttpError';
  }
}

export function resolveAlpacaCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = (process.env.ALPACA_API_KEY || '').trim();
  const apiSecret = (process.env.ALPACA_API_SECRET || '').trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function resolveAlpacaDataBaseUrl(): string {
  const raw = (process.env.ALPACA_DATA_URL || ALPACA_DATA_HOST_DEFAULT).trim().replace(/\/$/, '');
  // Guard: paper-api is trading — never use it for market data
  if (/paper-api\.alpaca\.markets/i.test(raw)) {
    return ALPACA_DATA_HOST_DEFAULT;
  }
  return raw || ALPACA_DATA_HOST_DEFAULT;
}

export class AlpacaMarketDataClient {
  private key: string;
  private secret: string;
  private base: string;
  private fetchFn: FetchLike;

  constructor(cfg: AlpacaClientConfig) {
    this.key = cfg.apiKey;
    this.secret = cfg.apiSecret;
    this.base = (cfg.dataBaseUrl || ALPACA_DATA_HOST_DEFAULT).replace(/\/$/, '');
    this.fetchFn = cfg.fetchFn || fetch;
  }

  private headers(): Record<string, string> {
    return {
      'APCA-API-KEY-ID': this.key,
      'APCA-API-SECRET-KEY': this.secret,
      Accept: 'application/json',
    };
  }

  private async getJson<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path.startsWith('http') ? path : `${this.base}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === '') continue;
        url.searchParams.set(k, String(v));
      }
    }
    const res = await this.fetchFn(url.toString(), { headers: this.headers(), cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      throw new AlpacaHttpError(res.status, url.pathname + url.search, text);
    }
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  /** SIP screener — most actives by volume. */
  async getMostActives(top = 50, by: 'volume' | 'trades' = 'volume'): Promise<{ symbol: string; volume: number }[]> {
    const data = await this.getJson<{
      most_actives?: { symbol: string; volume?: number; trade_count?: number }[];
    }>('/v1beta1/screener/stocks/most-actives', { by, top });
    return (data.most_actives || []).map((r) => ({
      symbol: r.symbol,
      volume: r.volume ?? 0,
    }));
  }

  /** SIP screener — gainers + losers. */
  async getMovers(top = 20): Promise<{ symbol: string; percentChange: number; price: number }[]> {
    const data = await this.getJson<{
      gainers?: { symbol: string; percent_change?: number; price?: number }[];
      losers?: { symbol: string; percent_change?: number; price?: number }[];
    }>('/v1beta1/screener/stocks/movers', { top });
    const rows = [...(data.gainers || []), ...(data.losers || [])];
    return rows.map((r) => ({
      symbol: r.symbol,
      percentChange: r.percent_change ?? 0,
      price: r.price ?? 0,
    }));
  }

  /** IEX multi-symbol snapshots. */
  async getSnapshots(symbols: string[], feed: 'iex' | 'sip' = 'iex'): Promise<Record<string, AlpacaSnapshotRaw>> {
    if (!symbols.length) return {};
    const out: Record<string, AlpacaSnapshotRaw> = {};
    const chunkSize = 50;
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const data = await this.getJson<Record<string, AlpacaSnapshotRaw>>('/v2/stocks/snapshots', {
        symbols: chunk.join(','),
        feed,
      });
      Object.assign(out, data);
    }
    return out;
  }

  /**
   * Bars for many symbols via **per-symbol** requests (paginated).
   * Default start = today's 09:30 ET.
   */
  async getBars(opts: {
    symbols: string[];
    timeframe?: string;
    feed?: 'iex' | 'sip';
    limit?: number;
    start?: string;
    end?: string;
  }): Promise<Record<string, AlpacaBarRaw[]>> {
    const {
      symbols,
      timeframe = '1Min',
      feed = 'iex',
      limit = 1000,
      start = etSessionStartIso(),
      end,
    } = opts;
    if (!symbols.length) return {};
    const out: Record<string, AlpacaBarRaw[]> = {};
    const concurrency = 5;
    for (let i = 0; i < symbols.length; i += concurrency) {
      const chunk = symbols.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (sym) => {
          out[sym] = await this.getBarsOne(sym, { timeframe, feed, limit, start, end });
        })
      );
    }
    return out;
  }

  /** Single-symbol `/v2/stocks/{symbol}/bars` with next_page_token pagination. */
  async getBarsOne(
    symbol: string,
    opts: {
      timeframe?: string;
      feed?: 'iex' | 'sip';
      limit?: number;
      start?: string;
      end?: string;
    } = {}
  ): Promise<AlpacaBarRaw[]> {
    const timeframe = opts.timeframe ?? '1Min';
    const feed = opts.feed ?? 'iex';
    const limit = opts.limit ?? 1000;
    const start = opts.start ?? etSessionStartIso();
    const end = opts.end;
    const all: AlpacaBarRaw[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 10; page++) {
      const data = await this.getJson<{
        bars?: AlpacaBarRaw[] | null;
        next_page_token?: string | null;
      }>(`/v2/stocks/${encodeURIComponent(symbol.toUpperCase())}/bars`, {
        timeframe,
        feed,
        limit: Math.min(limit, 1000),
        start,
        end,
        adjustment: 'raw',
        page_token: pageToken,
      });
      all.push(...(data.bars || []));
      pageToken = data.next_page_token || undefined;
      if (!pageToken || all.length >= limit) break;
    }
    return all.slice(0, limit);
  }
}

export function createAlpacaClientFromEnv(fetchFn?: FetchLike): AlpacaMarketDataClient | null {
  const creds = resolveAlpacaCredentials();
  if (!creds) return null;
  return new AlpacaMarketDataClient({
    ...creds,
    dataBaseUrl: resolveAlpacaDataBaseUrl(),
    fetchFn,
  });
}
