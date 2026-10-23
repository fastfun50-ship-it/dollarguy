import type { Bar } from '../types';

/**
 * Running Up v1: (close_t - close_{t-K}) / close_{t-K} ≥ X on 1-min bars
 * within K minutes (default K=5, X=0.05), and vol_sum_K ≥ Vmin (optional).
 */
export function detectRunningUp(
  bars: Bar[],
  opts: { k?: number; x?: number; vmin?: number } = {}
): { hit: boolean; bar: Bar | null; pct: number } {
  const k = opts.k ?? 5;
  const x = opts.x ?? 0.05;
  const vmin = opts.vmin ?? 0;
  if (bars.length < k + 1) return { hit: false, bar: null, pct: 0 };
  const cur = bars[bars.length - 1];
  const prev = bars[bars.length - 1 - k];
  if (!prev.c) return { hit: false, bar: null, pct: 0 };
  const pct = (cur.c - prev.c) / prev.c;
  const volSum = bars.slice(-k).reduce((s, b) => s + b.v, 0);
  if (pct >= x && volSum >= vmin) {
    return { hit: true, bar: cur, pct };
  }
  return { hit: false, bar: null, pct };
}
