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
