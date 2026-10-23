import type { Bar } from '../types';
import { minutesSinceMidnightEt } from '../session';

/** rvol_day = cum volume from 04:00 ET → now / mean of last 20 RTH daily volumes. */
export function rvolDay(barsToday: Bar[], avgDailyVol20d: number): number {
  if (!avgDailyVol20d || avgDailyVol20d <= 0) return 0;
  const cum = barsToday
    .filter((b) => minutesSinceMidnightEt(new Date(b.t)) >= 4 * 60)
    .reduce((s, b) => s + b.v, 0);
  return cum / avgDailyVol20d;
}

/**
 * rvol_5m = sum v of 5 latest completed 1-min bars /
 * mean same 5-min clock-slot over 20 trading days.
 * When historical slot average is missing, returns 0 (loud empty — not invented).
 */
export function rvol5m(
  completedBars: Bar[],
  avgSameSlot20d: number | null
): number {
  if (!avgSameSlot20d || avgSameSlot20d <= 0) return 0;
  if (completedBars.length < 5) return 0;
  const last5 = completedBars.slice(-5);
  const sum = last5.reduce((s, b) => s + b.v, 0);
  return sum / avgSameSlot20d;
}

export function relVolSpike(rvol5: number, threshold = 5): boolean {
  return rvol5 >= threshold;
}
