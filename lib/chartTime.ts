/**
 * Chart time helpers for TradingView lightweight-charts.
 * Library expects Unix **seconds** (UTCTimestamp), never milliseconds.
 */

import type { Bar } from './types';

export type ChartInterval = '1m' | '5m' | '15m' | '1t' | 'D';

/** Convert ISO string or epoch (sec or ms) → Unix seconds for lightweight-charts. */
export function toUtcSeconds(input: string | number): number {
  let ms: number;
  if (typeof input === 'number') {
    ms = input;
  } else {
    ms = new Date(input).getTime();
  }
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  // Values above ~year 2001 in ms (> 1e12) are milliseconds; otherwise already seconds.
  if (ms > 1e12) return Math.floor(ms / 1000);
  return Math.floor(ms);
}

export function aggregateBars(bars: Bar[], interval: ChartInterval): Bar[] {
  if (interval === '1m' || bars.length === 0) return bars;
  if (interval === 'D') {
    const first = bars[0];
    const last = bars[bars.length - 1];
    let h = first.h;
    let l = first.l;
    let v = 0;
    for (const b of bars) {
      h = Math.max(h, b.h);
      l = Math.min(l, b.l);
      v += b.v;
    }
    return [{ t: first.t, o: first.o, h, l, c: last.c, v }];
  }
  const minutes = interval === '5m' ? 5 : interval === '15m' ? 15 : 60;
  const out: Bar[] = [];
  let bucket: Bar | null = null;
  let bucketStart = -1;
  for (const b of bars) {
    const m = Math.floor(new Date(b.t).getTime() / 60_000);
    const start = Math.floor(m / minutes) * minutes;
    if (!bucket || start !== bucketStart) {
      if (bucket) out.push(bucket);
      bucket = { ...b };
      bucketStart = start;
    } else {
      bucket.h = Math.max(bucket.h, b.h);
      bucket.l = Math.min(bucket.l, b.l);
      bucket.c = b.c;
      bucket.v += b.v;
      bucket.t = b.t;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumePoint {
  time: number;
  value: number;
  color: string;
}

/** Aggregate, convert to seconds, dedupe by time, sort ascending. */
export function prepareChartSeries(
  bars: Bar[],
  interval: ChartInterval
): { candles: CandlePoint[]; volumes: VolumePoint[] } {
  const series = aggregateBars(bars, interval);
  const byTime = new Map<number, { bar: Bar; time: number }>();
  for (const b of series) {
    const time = toUtcSeconds(b.t);
    if (time <= 0) continue;
    byTime.set(time, { bar: b, time });
  }
  const ordered = [...byTime.values()].sort((a, b) => a.time - b.time);
  const candles: CandlePoint[] = ordered.map(({ bar, time }) => ({
    time,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
  }));
  const volumes: VolumePoint[] = ordered.map(({ bar, time }) => ({
    time,
    value: bar.v,
    color: bar.c >= bar.o ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)',
  }));
  return { candles, volumes };
}

/** Running session VWAP from real bars only — no interpolated points. */
export function computeVwapSeries(
  bars: Bar[]
): { time: number; value: number }[] {
  let pv = 0;
  let vol = 0;
  const out: { time: number; value: number }[] = [];
  for (const b of bars) {
    const time = toUtcSeconds(b.t);
    if (time <= 0) continue;
    const typical = (b.h + b.l + b.c) / 3;
    const v = b.v ?? 0;
    if (!(v > 0)) continue; // skip zero-volume — do not invent VWAP
    pv += typical * v;
    vol += v;
    if (vol > 0) {
      out.push({ time, value: pv / vol });
    }
  }
  // Dedupe by time (last wins)
  const byTime = new Map<number, number>();
  for (const p of out) byTime.set(p.time, p.value);
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time, value }));
}

/**
 * Visible logical range so sparse IEX bars stay narrow (not 3 huge blocks).
 * Dense series (≥ minSlots) uses full fit. Never invents candles.
 */
export function visibleLogicalRangeForBars(
  barCount: number,
  minSlots = 48
): { from: number; to: number } {
  if (barCount <= 0) return { from: 0, to: Math.max(minSlots, 1) };
  if (barCount >= minSlots) {
    return { from: -0.5, to: barCount - 0.5 };
  }
  // Align real bars to the left; empty logical space on the right.
  return { from: -0.5, to: minSlots - 0.5 };
}

export function formatEtShort(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
