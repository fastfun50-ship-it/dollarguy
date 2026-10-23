import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toUtcSeconds, prepareChartSeries, aggregateBars, computeVwapSeries, visibleLogicalRangeForBars } from '../lib/chartTime';
import type { Bar } from '../lib/types';

function bar(iso: string, c = 1): Bar {
  return { t: iso, o: c, h: c + 0.1, l: c - 0.1, c, v: 1000 };
}

describe('chartTime — lightweight-charts seconds', () => {
  it('ISO → Unix seconds (not ms)', () => {
    const sec = toUtcSeconds('2026-10-23T13:30:00.000Z');
    assert.equal(sec, 1792762200);
    assert.ok(sec < 1e12, 'must be seconds, not milliseconds');
  });

  it('tolerates accidental millisecond epoch', () => {
    const ms = 1792762200_000;
    assert.equal(toUtcSeconds(ms), 1792762200);
  });

  it('passes through second epoch unchanged', () => {
    assert.equal(toUtcSeconds(1792762200), 1792762200);
  });

  it('prepareChartSeries sorts + dedupes by second', () => {
    const bars: Bar[] = [
      bar('2026-10-23T13:31:00Z', 2),
      bar('2026-10-23T13:30:00Z', 1),
      bar('2026-10-23T13:31:00.500Z', 3), // same second as 13:31 → last wins
    ];
    const { candles, volumes } = prepareChartSeries(bars, '1m');
    assert.equal(candles.length, 2);
    assert.equal(candles[0].time, toUtcSeconds('2026-10-23T13:30:00Z'));
    assert.equal(candles[1].time, toUtcSeconds('2026-10-23T13:31:00Z'));
    assert.equal(candles[1].close, 3);
    assert.equal(volumes.length, 2);
    assert.ok(candles.every((c) => c.time < 1e12));
  });

  it('aggregate 5m keeps ascending times', () => {
    const bars = [
      bar('2026-10-23T13:30:00Z', 1),
      bar('2026-10-23T13:31:00Z', 2),
      bar('2026-10-23T13:32:00Z', 3),
      bar('2026-10-23T13:35:00Z', 4),
    ];
    const agg = aggregateBars(bars, '5m');
    assert.ok(agg.length >= 2);
    const times = agg.map((b) => toUtcSeconds(b.t));
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] >= times[i - 1]);
    }
  });
});

describe('chartTime — VWAP series + sparse range', () => {
  it('computeVwapSeries skips zero-volume (no invented points)', () => {
    const bars: Bar[] = [
      { t: '2026-10-23T13:30:00Z', o: 1, h: 1.1, l: 0.9, c: 1, v: 0 },
      { t: '2026-10-23T13:31:00Z', o: 1, h: 1.2, l: 0.9, c: 1.1, v: 1000 },
      { t: '2026-10-23T13:32:00Z', o: 1.1, h: 1.3, l: 1.0, c: 1.2, v: 1000 },
    ];
    const s = computeVwapSeries(bars);
    assert.equal(s.length, 2);
  });

  it('sparse visible range keeps min slots (candles stay narrow)', () => {
    const r = visibleLogicalRangeForBars(3, 48);
    assert.ok(r.to - r.from >= 47);
    const dense = visibleLogicalRangeForBars(100, 48);
    assert.ok(dense.to - dense.from < 110);
  });
});
