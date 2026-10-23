/**
 * Alpaca Market Data API client (Basic / IEX + SIP screener).
 * Host: https://data.alpaca.markets — NOT paper-api (trading).
 * No order endpoints. Fetch is injectable for unit tests (no live HTTP required).
 *
 * Bars: always **per-symbol** + pagination. Multi-symbol `/v2/stocks/bars` with a
 * shared limit starves thin names when AAPL fills page 1 (Mira coverage 2026-10-23).
 *
 * Rate limit: getJson retries 429 with Retry-After; getBars concurrency ≤2 + in-flight dedupe.
 */

import { etSessionStartIso } from '../session';

export const ALPACA_DATA_HOST_DEFAULT = 'https://data.alpaca.markets';

/** Max parallel per-symbol bar fetches (Basic plan). */
export const BARS_CONCURRENCY = 2;

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
  retryAfterMs?: number;
  constructor(status: number, path: string, body: string, retryAfterMs?: number) {
    super(`Alpaca ${status} ${path}: ${body.slice(0, 200)}`);
    this.status = status;
    this.path = path;
    this.retryAfterMs = retryAfterMs;
    this.name = 'AlpacaHttpError';
  }
}

export function isAlpacaRateLimit(e: unknown): boolean {
  if (e instanceof AlpacaHttpError && e.status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /429|too many requests|rate limit/i.test(msg);
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterMs(res: Response): number | undefined {
  const ra = res.headers.get('Retry-After');
  if (!ra) return undefined;
  const asInt = Number(ra);
  if (Number.isFinite(asInt) && asInt >= 0) return Math.min(asInt * 1000, 60_000);
  const when = Date.parse(ra);
  if (!Number.isNaN(when)) return Math.min(Math.max(0, when - Date.now()), 60_000);
  return undefined;
}

export class AlpacaMarketDataClient {
  private key: string;
  private secret: string;
  private base: string;
  private fetchFn: FetchLike;
  /** In-flight dedupe for identical getBarsOne keys. */
  private barsInflight = new Map<string, Promise<AlpacaBarRaw[]>>();

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
    const maxAttempts = 4;
    let lastErr: AlpacaHttpError | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await this.fetchFn(url.toString(), { headers: this.headers(), cache: 'no-store' });
      const text = await res.text();
      if (res.status === 429) {
        const retryAfterMs = parseRetryAfterMs(res) ?? Math.min(1000 * 2 ** attempt, 16_000);
        lastErr = new AlpacaHttpError(429, url.pathname + url.search, text, retryAfterMs);
        if (attempt < maxAttempts - 1) {
          await sleep(retryAfterMs);
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) {
        throw new AlpacaHttpError(res.status, url.pathname + url.search, text);
      }
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    }
    throw lastErr ?? new AlpacaHttpError(429, url.pathname, 'rate limited');
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
   * Concurrency capped; one symbol failure does not abort the rest.
   * Default start = today's 09:30 ET.
   */
  async getBars(opts: {
    symbols: string[];
    timeframe?: string;
    feed?: 'iex' | 'sip';
    limit?: number;
    start?: string;
    end?: string;
  }): Promise<{ bars: Record<string, AlpacaBarRaw[]>; rateLimited: boolean; errors: Record<string, string> }> {
    const {
      symbols,
      timeframe = '1Min',
      feed = 'iex',
      limit = 1000,
      start = etSessionStartIso(),
      end,
    } = opts;
    const bars: Record<string, AlpacaBarRaw[]> = {};
    const errors: Record<string, string> = {};
    let rateLimited = false;
    if (!symbols.length) return { bars, rateLimited, errors };

    const queue = [...symbols];
    const workers = Math.min(BARS_CONCURRENCY, queue.length);
    const runOne = async () => {
      while (queue.length) {
        const sym = queue.shift()!;
        try {
          bars[sym] = await this.getBarsOne(sym, { timeframe, feed, limit, start, end });
        } catch (e) {
          bars[sym] = [];
          errors[sym] = e instanceof Error ? e.message : String(e);
          if (isAlpacaRateLimit(e)) rateLimited = true;
        }
      }
    };
    await Promise.all(Array.from({ length: workers }, () => runOne()));
    return { bars, rateLimited, errors };
  }

  /** Single-symbol `/v2/stocks/{symbol}/bars` with next_page_token pagination + in-flight dedupe. */
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
    const key = `${symbol.toUpperCase()}|${timeframe}|${feed}|${limit}|${start}|${end ?? ''}`;
    const existing = this.barsInflight.get(key);
    if (existing) return existing;

    const work = (async () => {
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
    })();

    this.barsInflight.set(key, work);
    try {
      return await work;
    } finally {
      this.barsInflight.delete(key);
    }
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
