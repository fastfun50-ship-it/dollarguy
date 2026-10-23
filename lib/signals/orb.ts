import type { Bar } from '../types';
import { isInOpeningRange, minutesSinceMidnightEt } from '../session';

export interface OrRange {
  high: number;
  low: number;
  ready: boolean;
}

/** OR high/low from 1-min bars in [09:30, 09:30+N). Premarket excluded. */
export function computeOpeningRange(bars: Bar[], orbN = 5): OrRange {
  const orBars = bars.filter((b) => isInOpeningRange(b.t, orbN));
  if (orBars.length === 0) return { high: 0, low: 0, ready: false };
  const high = Math.max(...orBars.map((b) => b.h));
  const low = Math.min(...orBars.map((b) => b.l));
  const lastOrEnd = 9 * 60 + 30 + orbN;
  const anyAfter = bars.some(
    (b) => minutesSinceMidnightEt(new Date(b.t)) >= lastOrEnd
  );
  return { high, low, ready: anyAfter && orBars.length > 0 };
}

/**
 * ORB alert: first completed 1-min bar AFTER the OR window with close > OR_high.
 * Max 1 per ticker/session — caller enforces.
 */
export function detectOrbBreak(
  bars: Bar[],
  orbN = 5
): { hit: boolean; bar: Bar | null; orHigh: number; orLow: number } {
  const or = computeOpeningRange(bars, orbN);
  if (!or.ready) return { hit: false, bar: null, orHigh: or.high, orLow: or.low };
  const after = bars.filter(
    (b) => minutesSinceMidnightEt(new Date(b.t)) >= 9 * 60 + 30 + orbN
  );
  for (const bar of after) {
    if (bar.c > or.high) {
      return { hit: true, bar, orHigh: or.high, orLow: or.low };
    }
  }
  return { hit: false, bar: null, orHigh: or.high, orLow: or.low };
}
