import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AlpacaMarketDataClient,
  resolveAlpacaDataBaseUrl,
  resolveAlpacaCredentials,
  ALPACA_DATA_HOST_DEFAULT,
} from '../lib/data/alpacaClient';
import { AlpacaProvider } from '../lib/data/alpacaProvider';
import {
  getMarketDataProvider,
  hasVendorKeys,
  providerMeta,
  resolveDataProviderKind,
  resetMarketDataProviderForTests,
} from '../lib/data/provider';

const saved: Record<string, string | undefined> = {};

function stashEnv(keys: string[]) {
  for (const k of keys) saved[k] = process.env[k];
}
function restoreEnv() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('Alpaca provider selection (no live HTTP)', () => {
  beforeEach(() => {
    stashEnv([
      'DATA_PROVIDER',
      'ALPACA_API_KEY',
      'ALPACA_API_SECRET',
      'ALPACA_DATA_URL',
      'FORCE_EXAMPLE',
      'MASSIVE_API_KEY',
      'POLYGON_API_KEY',
    ]);
    delete process.env.FORCE_EXAMPLE;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
    delete process.env.ALPACA_DATA_URL;
    resetMarketDataProviderForTests();
  });
  afterEach(() => restoreEnv());

  it('defaults to EXAMPLE without keys', () => {
    delete process.env.DATA_PROVIDER;
    assert.equal(resolveDataProviderKind(), 'example');
    const p = getMarketDataProvider();
    assert.equal(p.mode, 'EXAMPLE');
    const meta = providerMeta();
    assert.equal(meta.mode, 'EXAMPLE');
  });

  it('alpaca without keys → hasVendorKeys false + loud LiveUnavailable', async () => {
    process.env.DATA_PROVIDER = 'alpaca';
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
    assert.equal(hasVendorKeys('alpaca'), false);
    const p = getMarketDataProvider();
    assert.equal(p.feedStatus, 'NOT_CONFIGURED');
    await assert.rejects(() => p.listUniverse(), /nøgle|mangler/i);
  });

  it('alpaca with keys → LIVE provider (not stub message)', () => {
    process.env.DATA_PROVIDER = 'alpaca';
    process.env.ALPACA_API_KEY = 'test-key';
    process.env.ALPACA_API_SECRET = 'test-secret';
    assert.equal(hasVendorKeys('alpaca'), true);
    const p = getMarketDataProvider();
    assert.equal(p.mode, 'LIVE');
    assert.match(p.feedLabel, /IEX|ALPACA/i);
    const meta = providerMeta();
    assert.equal(meta.mode, 'LIVE');
    assert.equal(meta.keysPresent, true);
    assert.doesNotMatch(meta.note, /ikke implementeret/i);
  });

  it('paper-api URL is rewritten to data.alpaca.markets', () => {
    process.env.ALPACA_DATA_URL = 'https://paper-api.alpaca.markets/v2';
    assert.equal(resolveAlpacaDataBaseUrl(), ALPACA_DATA_HOST_DEFAULT);
  });

  it('resolveAlpacaCredentials null without both keys', () => {
    process.env.ALPACA_API_KEY = 'only-key';
    delete process.env.ALPACA_API_SECRET;
    assert.equal(resolveAlpacaCredentials(), null);
  });
});

describe('Alpaca client + provider with mocked fetch', () => {
  it('maps screener + snapshots + bars without network', async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/most-actives')) {
        return new Response(
          JSON.stringify({ most_actives: [{ symbol: 'AAA', volume: 1e6 }] }),
          { status: 200 }
        );
      }
      if (url.includes('/movers')) {
        return new Response(
          JSON.stringify({
            gainers: [{ symbol: 'BBB', percent_change: 12, price: 5.5 }],
            losers: [],
          }),
          { status: 200 }
        );
      }
      if (url.includes('/snapshots')) {
        return new Response(
          JSON.stringify({
            AAA: {
              latestTrade: { p: 4.2 },
              dailyBar: { t: '2026-10-23T04:00:00Z', o: 3.8, h: 4.5, l: 3.7, c: 4.2, v: 900000 },
              prevDailyBar: { t: '2026-10-22T04:00:00Z', o: 3.5, h: 3.9, l: 3.4, c: 3.6, v: 400000 },
            },
            BBB: {
              latestTrade: { p: 5.5 },
              dailyBar: { t: '2026-10-23T04:00:00Z', o: 4.9, h: 5.6, l: 4.8, c: 5.5, v: 800000 },
              prevDailyBar: { t: '2026-10-22T04:00:00Z', o: 4.5, h: 5.0, l: 4.4, c: 4.8, v: 300000 },
            },
          }),
          { status: 200 }
        );
      }
      // Per-symbol: /v2/stocks/AAA/bars (array), not multi /v2/stocks/bars
      const symBars = url.match(/\/stocks\/([A-Z]+)\/bars/i);
      if (symBars) {
        const sym = symBars[1].toUpperCase();
        const c = sym === 'BBB' ? 5.5 : 4.2;
        const mk = [
          { t: '2026-10-23T13:30:00Z', o: c - 0.1, h: c + 0.1, l: c - 0.2, c, v: 10000 },
          { t: '2026-10-23T13:31:00Z', o: c, h: c + 0.2, l: c - 0.05, c: c + 0.05, v: 12000 },
        ];
        // Need 5 bars with v>0 for avgSlot5m / rvol paths that require volume
        const bars = [...mk, ...mk, ...mk].slice(0, 6).map((b, i) => ({
          ...b,
          t: `2026-10-23T13:${String(30 + i).padStart(2, '0')}:00Z`,
        }));
        return new Response(JSON.stringify({ bars, next_page_token: null }), { status: 200 });
      }
      return new Response('unexpected ' + url, { status: 500 });
    };

    const client = new AlpacaMarketDataClient({
      apiKey: 'k',
      apiSecret: 's',
      dataBaseUrl: 'https://data.alpaca.markets',
      fetchFn,
    });
    const provider = new AlpacaProvider(client, { topDiscovery: 10, barLimit: 50 });
    const universe = await provider.listUniverse();
    assert.ok(universe.length >= 2);
    assert.ok(universe.every((u) => u.bars.length > 0));
    assert.ok(universe.every((u) => u.last > 0));
    assert.ok(calls.some((u) => u.includes('data.alpaca.markets')));
    assert.ok(!calls.some((u) => /paper-api/i.test(u)));
    assert.ok(calls.some((u) => u.includes('most-actives')));
    assert.ok(calls.some((u) => u.includes('movers')));
    assert.ok(calls.some((u) => u.includes('feed=iex')));
  });

  it('HTTP error surfaces loud (no silent empty EXAMPLE)', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 });
    const client = new AlpacaMarketDataClient({
      apiKey: 'k',
      apiSecret: 's',
      fetchFn,
    });
    const provider = new AlpacaProvider(client);
    await assert.rejects(() => provider.listUniverse(), /401|fejlede|loud/i);
  });
});

describe('Alpaca rate-limit + cache (mocked)', () => {
  it('getJson retries 429 using Retry-After', async () => {
    let n = 0;
    const fetchFn: typeof fetch = async () => {
      n += 1;
      if (n === 1) {
        return new Response('too many requests', {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      }
      return new Response(
        JSON.stringify({ most_actives: [{ symbol: 'ZZZ', volume: 1 }] }),
        { status: 200 }
      );
    };
    const client = new AlpacaMarketDataClient({
      apiKey: 'k',
      apiSecret: 's',
      fetchFn,
    });
    const rows = await client.getMostActives(1);
    assert.equal(n, 2);
    assert.equal(rows[0]?.symbol, 'ZZZ');
  });

  it('listUniverse TTL cache + single-flight skip repeat discovery', async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/most-actives')) {
        return new Response(
          JSON.stringify({ most_actives: [{ symbol: 'AAA', volume: 1e6 }] }),
          { status: 200 }
        );
      }
      if (url.includes('/movers')) {
        return new Response(JSON.stringify({ gainers: [], losers: [] }), { status: 200 });
      }
      if (url.includes('/snapshots')) {
        return new Response(
          JSON.stringify({
            AAA: {
              latestTrade: { p: 4.2 },
              dailyBar: { t: '2026-10-23T04:00:00Z', o: 3.8, h: 4.5, l: 3.7, c: 4.2, v: 900000 },
              prevDailyBar: { t: '2026-10-22T04:00:00Z', o: 3.5, h: 3.9, l: 3.4, c: 3.6, v: 400000 },
            },
          }),
          { status: 200 }
        );
      }
      if (/\/stocks\/AAA\/bars/i.test(url)) {
        const bars = Array.from({ length: 6 }, (_, i) => ({
          t: `2026-10-23T13:${String(30 + i).padStart(2, '0')}:00Z`,
          o: 4,
          h: 4.2,
          l: 3.9,
          c: 4.1,
          v: 1000,
        }));
        return new Response(JSON.stringify({ bars }), { status: 200 });
      }
      return new Response('nope ' + url, { status: 500 });
    };
    const client = new AlpacaMarketDataClient({ apiKey: 'k', apiSecret: 's', fetchFn });
    const provider = new AlpacaProvider(client, { topDiscovery: 5, barLimit: 20 });
    const [a, b] = await Promise.all([provider.listUniverse(), provider.listUniverse()]);
    assert.equal(a.length, b.length);
    const actives = calls.filter((u) => u.includes('most-actives')).length;
    assert.equal(actives, 1, 'single-flight should hit discovery once');
    const after = calls.length;
    await provider.listUniverse();
    assert.equal(calls.length, after, 'TTL cache should not refetch');
    const barsAgain = await provider.getBars('AAA');
    assert.ok(barsAgain.length > 0);
    assert.equal(calls.length, after, 'getBars should use bars cache');
  });

  it('partial bars 429 keeps other symbols + RATE_LIMITED', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/most-actives')) {
        return new Response(
          JSON.stringify({
            most_actives: [
              { symbol: 'AAA', volume: 1e6 },
              { symbol: 'BBB', volume: 9e5 },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes('/movers')) {
        return new Response(JSON.stringify({ gainers: [], losers: [] }), { status: 200 });
      }
      if (url.includes('/snapshots')) {
        return new Response(
          JSON.stringify({
            AAA: {
              latestTrade: { p: 4.2 },
              dailyBar: { t: '2026-10-23T04:00:00Z', o: 3.8, h: 4.5, l: 3.7, c: 4.2, v: 900000 },
              prevDailyBar: { t: '2026-10-22T04:00:00Z', o: 3.5, h: 3.9, l: 3.4, c: 3.6, v: 400000 },
            },
            BBB: {
              latestTrade: { p: 5.5 },
              dailyBar: { t: '2026-10-23T04:00:00Z', o: 4.9, h: 5.6, l: 4.8, c: 5.5, v: 800000 },
              prevDailyBar: { t: '2026-10-22T04:00:00Z', o: 4.5, h: 5.0, l: 4.4, c: 4.8, v: 300000 },
            },
          }),
          { status: 200 }
        );
      }
      if (/\/stocks\/BBB\/bars/i.test(url)) {
        return new Response('too many', { status: 429, headers: { 'Retry-After': '0' } });
      }
      if (/\/stocks\/AAA\/bars/i.test(url)) {
        const bars = Array.from({ length: 6 }, (_, i) => ({
          t: `2026-10-23T13:${String(30 + i).padStart(2, '0')}:00Z`,
          o: 4,
          h: 4.2,
          l: 3.9,
          c: 4.1,
          v: 1000,
        }));
        return new Response(JSON.stringify({ bars }), { status: 200 });
      }
      return new Response('x', { status: 500 });
    };
    const client = new AlpacaMarketDataClient({ apiKey: 'k', apiSecret: 's', fetchFn });
    const provider = new AlpacaProvider(client, { topDiscovery: 5, barLimit: 20 });
    const universe = await provider.listUniverse();
    assert.ok(universe.some((u) => u.symbol === 'AAA' && u.bars.length > 0));
    assert.equal(provider.feedStatus, 'RATE_LIMITED');
  });
});
