import type { Bar } from '../types';
import { minutesSinceMidnightEt } from '../session';

/**
 * rvol_day = cum volume from 04:00 ET → now / mean of last 20 RTH daily volumes.
 * Returns null when baseline or cum volume is missing/unusable — never a fake 0×.
 */
export function rvolDay(
  barsToday: Bar[],
  avgDailyVol20d: number | null | undefined,
  /** Optional day volume from snapshot when minute bars lack v (IEX). */
  dayVolumeFallback?: number | null
): number | null {
  if (!avgDailyVol20d || avgDailyVol20d <= 0) return null;
  let cum = barsToday
    .filter((b) => minutesSinceMidnightEt(new Date(b.t)) >= 4 * 60)
    .reduce((s, b) => s + b.v, 0);
  if (cum <= 0 && dayVolumeFallback != null && dayVolumeFallback > 0) {
    cum = dayVolumeFallback;
  }
  if (cum <= 0) return null;
  return cum / avgDailyVol20d;
}

/**
 * rvol_5m = sum v of 5 latest completed 1-min bars /
 * mean same 5-min clock-slot over 20 trading days.
 * Returns null when baseline missing, too few bars, or bar volumes are all zero
 * (incomplete feed) — never present as measured 0×.
 */
export function rvol5m(
  completedBars: Bar[],
  avgSameSlot20d: number | null | undefined
): number | null {
  if (!avgSameSlot20d || avgSameSlot20d <= 0) return null;
  if (completedBars.length < 5) return null;
  const last5 = completedBars.slice(-5);
  const sum = last5.reduce((s, b) => s + b.v, 0);
  if (sum <= 0) return null;
  return sum / avgSameSlot20d;
}

export function relVolSpike(rvol5: number | null, threshold = 5): boolean {
  if (rvol5 == null) return false;
  return rvol5 >= threshold;
}
