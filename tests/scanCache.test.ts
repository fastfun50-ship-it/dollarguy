import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  runScan,
  clearScanCacheForTests,
  clearHodStatesForTests,
  seedLastGoodScanForTests,
} from '../lib/scanner';
import { clearAlertsForTests } from '../lib/alerts/store';
import { resetMarketDataProviderForTests } from '../lib/data/provider';
import type { Candidate, ScanStatus } from '../lib/types';

const saved: Record<string, string | undefined> = {};
function stash(keys: string[]) {
  for (const k of keys) saved[k] = process.env[k];
}
function restore() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function fakeLiveScan(feed: ScanStatus['feed'] = 'OK') {
  const candidates: Candidate[] = [
    {
      symbol: 'FAKE',
      name: 'FAKE',
      last: 5,
      chgClosePct: 0.1,
      chgAbs: 0.5,
      gapPct: 0.1,
      rvolDay: 2,
      rvol5m: 3,
      volume: 1e6,
      float: null,
      signal: 'GAP',
      ageMin: 10,
      why: ['seed'],
    },
  ];
  const status: ScanStatus = {
    mode: 'LIVE',
    session: 'RTH',
    feed,
    feedLabel: 'ALPACA · test',
    lastUpdateEt: '10:00:00',
    dbConfigured: false,
    ws: 'OK',
    message: 'seeded',
  };
  return { status, candidates, alerts: [] };
}

describe('scan last-good cache (LIVE failure paths)', () => {
  beforeEach(() => {
    stash(['DATA_PROVIDER', 'ALPACA_API_KEY', 'ALPACA_API_SECRET', 'FORCE_EXAMPLE']);
    clearScanCacheForTests();
    clearHodStatesForTests();
    clearAlertsForTests();
    resetMarketDataProviderForTests();
  });
  afterEach(() => {
    restore();
    clearScanCacheForTests();
    resetMarketDataProviderForTests();
  });

  it('(b) failure without prior data → empty candidates + NOT_CONFIGURED', async () => {
    process.env.DATA_PROVIDER = 'alpaca';
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
    delete process.env.FORCE_EXAMPLE;
    const { status, candidates } = await runScan();
    assert.equal(candidates.length, 0);
    assert.equal(status.feed, 'NOT_CONFIGURED');
    assert.ok(status.message && /nøgle|mangler|konfigureret/i.test(status.message));
  });

  it('(a) prior LIVE scan → STALE with same candidates on feed failure', async () => {
    seedLastGoodScanForTests(fakeLiveScan('OK'));
    process.env.DATA_PROVIDER = 'alpaca';
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
    delete process.env.FORCE_EXAMPLE;
    resetMarketDataProviderForTests();
    const { status, candidates } = await runScan();
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].symbol, 'FAKE');
    assert.equal(status.mode, 'LIVE');
    assert.equal(status.feed, 'STALE');
    assert.match(status.message ?? '', /sidste gode|begrænset|fejl/i);
  });

  it('EXAMPLE prior must not leak into alpaca-misconfig', async () => {
    process.env.DATA_PROVIDER = 'example';
    const first = await runScan();
    assert.ok(first.candidates.length > 0);
    assert.equal(first.status.mode, 'EXAMPLE');

    process.env.DATA_PROVIDER = 'alpaca';
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_API_SECRET;
    resetMarketDataProviderForTests();
    const second = await runScan();
    assert.equal(second.candidates.length, 0);
    assert.equal(second.status.feed, 'NOT_CONFIGURED');
  });
});
