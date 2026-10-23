import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectOrbBreak, computeOpeningRange } from '../lib/signals/orb';
import { detectHod, initialHodState } from '../lib/signals/hod';
import { rvol5m, rvolDay } from '../lib/signals/rvol';
import { detectRunningUp } from '../lib/signals/runningUp';
import { gapOpenPct } from '../lib/signals/gap';
import type { Bar } from '../lib/types';

function bar(et: string, o: number, h: number, l: number, c: number, v: number): Bar {
  return { t: new Date(`2026-10-23T${et}-04:00`).toISOString(), o, h, l, c, v };
}

describe('ORB_N=5 close-break', () => {
  it('computes OR from [09:30,09:35) and alerts on close > OR_high after', () => {
    const bars: Bar[] = [
      bar('09:30:00', 10, 10.2, 9.9, 10.1, 1000),
      bar('09:31:00', 10.1, 10.3, 10.0, 10.2, 1000),
      bar('09:32:00', 10.2, 10.4, 10.1, 10.3, 1000),
      bar('09:33:00', 10.3, 10.35, 10.2, 10.25, 1000),
      bar('09:34:00', 10.25, 10.4, 10.2, 10.3, 1000),
      // after OR — wick above but close below → no
      bar('09:35:00', 10.3, 10.5, 10.2, 10.35, 1000),
      // close break
      bar('09:36:00', 10.35, 10.6, 10.3, 10.55, 2000),
    ];
    const or = computeOpeningRange(bars, 5);
    assert.equal(or.ready, true);
    assert.ok(or.high >= 10.4);
    const hit = detectOrbBreak(bars, 5);
    assert.equal(hit.hit, true);
    assert.ok(hit.bar && hit.bar.c > or.high);
  });

  it('does not use premarket for OR', () => {
    const bars: Bar[] = [
      bar('09:00:00', 12, 12.5, 11.9, 12.2, 5000),
      bar('09:30:00', 10, 10.1, 9.9, 10, 1000),
      bar('09:31:00', 10, 10.1, 9.9, 10, 1000),
      bar('09:32:00', 10, 10.1, 9.9, 10, 1000),
      bar('09:33:00', 10, 10.1, 9.9, 10, 1000),
      bar('09:34:00', 10, 10.1, 9.9, 10, 1000),
      bar('09:35:00', 10, 10.2, 9.9, 10.15, 1000),
    ];
    const or = computeOpeningRange(bars, 5);
    assert.ok(or.high < 11);
  });
});

describe('HOD RTH + cooldown', () => {
  it('fires on new RTH high and suppresses within cooldown', () => {
    // Tight ranges so intervening lows stay <0.5% below lastAlertHigh
    const bars: Bar[] = [
      bar('09:30:00', 5.0, 5.1, 5.0, 5.05, 1000),
    ];
    const first = detectHod(bars, initialHodState(), { rvol5m: 3, cooldownMin: 3, pullbackPct: 0.005 });
    assert.equal(first.hit, true);
    assert.equal(first.newHigh, 5.1);
    // Climb with shallow dip only: low 5.098 → pullback ≈0.04% < 0.5%
    const climb: Bar[] = [
      ...bars,
      bar('09:31:00', 5.05, 5.2, 5.098, 5.15, 1000),
      bar('09:32:00', 5.15, 5.4, 5.14, 5.35, 1000),
    ];
    const second = detectHod(climb, first.nextState, { rvol5m: 3, cooldownMin: 3, pullbackPct: 0.005 });
    assert.equal(second.hit, false);
  });

  it('ignores premarket highs', () => {
    const bars: Bar[] = [
      bar('09:00:00', 6, 7, 5.9, 6.5, 1000),
      bar('09:30:00', 5, 5.1, 4.9, 5.0, 1000),
    ];
    const r = detectHod(bars, initialHodState(), { rvol5m: 5 });
    assert.equal(r.hit, true);
    assert.ok(r.newHigh < 6);
  });

  it('fires again after ≥0.5% pullback within cooldown', () => {
    const firstBars: Bar[] = [
      bar('09:30:00', 5, 5.1, 4.9, 5.05, 1000),
    ];
    const first = detectHod(firstBars, initialHodState(), {
      rvol5m: 3,
      cooldownMin: 3,
      pullbackPct: 0.005,
    });
    assert.equal(first.hit, true);
    assert.equal(first.newHigh, 5.1);

    // Intervening low 5.07 ≤ 5.1 * 0.995 → pullback OK, then new high
    const afterPullback: Bar[] = [
      ...firstBars,
      bar('09:31:00', 5.05, 5.08, 5.07, 5.07, 1000),
      bar('09:32:00', 5.07, 5.25, 5.06, 5.2, 1000),
    ];
    const second = detectHod(afterPullback, first.nextState, {
      rvol5m: 3,
      cooldownMin: 3,
      pullbackPct: 0.005,
    });
    assert.equal(second.hit, true);
    assert.ok(second.newHigh > 5.1);
  });

  it('still suppresses shallow dip (<0.5%) inside cooldown', () => {
    const firstBars: Bar[] = [bar('09:30:00', 5, 5.1, 4.9, 5.05, 1000)];
    const first = detectHod(firstBars, initialHodState(), {
      rvol5m: 3,
      cooldownMin: 3,
      pullbackPct: 0.005,
    });
    // low 5.09 → pullback = (5.1-5.09)/5.1 ≈ 0.196% < 0.5%
    const shallow: Bar[] = [
      ...firstBars,
      bar('09:31:00', 5.08, 5.095, 5.09, 5.092, 1000),
      bar('09:32:00', 5.09, 5.2, 5.09, 5.15, 1000),
    ];
    const second = detectHod(shallow, first.nextState, {
      rvol5m: 3,
      cooldownMin: 3,
      pullbackPct: 0.005,
    });
    assert.equal(second.hit, false);
  });
});

describe('rvol', () => {
  it('rvol_5m uses last 5 completed bars / slot avg', () => {
    const bars: Bar[] = Array.from({ length: 5 }, (_, i) =>
      bar(`09:4${i}:00`, 1, 1, 1, 1, 10_000)
    );
    assert.equal(rvol5m(bars, 10_000), 5);
    assert.equal(rvol5m(bars, null), 0);
  });

  it('rvol_day divides by 20d avg', () => {
    const bars = [bar('09:30:00', 1, 1, 1, 1, 50_000)];
    assert.equal(rvolDay(bars, 100_000), 0.5);
  });
});

describe('running up + gap', () => {
  it('detects +5% over K=5', () => {
    const bars: Bar[] = [];
    let c = 10;
    for (let i = 0; i < 6; i++) {
      c = 10 + i * 0.12;
      bars.push(bar(`09:3${i}:00`, c, c, c, c, 5000));
    }
    const r = detectRunningUp(bars, { k: 5, x: 0.05 });
    assert.equal(r.hit, true);
  });

  it('gap_open_pct', () => {
    assert.ok(Math.abs(gapOpenPct(10.4, 10) - 0.04) < 1e-9);
  });
});
