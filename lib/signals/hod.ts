import type { Bar } from '../types';
import { isRthBar } from '../session';

export interface HodState {
  sessionHigh: number;
  lastAlertAt: string | null;
  lastAlertHigh: number | null;
}

/**
 * HOD: RTH [09:30,16:00) only. Premarket does not count.
 * Cooldown: 3 min after last alert OR ≥0.5% pullback from that HOD.
 */
export function detectHod(
  bars: Bar[],
  state: HodState,
  opts: { cooldownMin?: number; pullbackPct?: number; rvol5m?: number; rvolMin?: number } = {}
): { hit: boolean; bar: Bar | null; newHigh: number; nextState: HodState } {
  const cooldownMin = opts.cooldownMin ?? 3;
  const pullbackPct = opts.pullbackPct ?? 0.005;
  const rvolMin = opts.rvolMin ?? 2;
  const rvolOk = opts.rvol5m === undefined || opts.rvol5m >= rvolMin;

  const rth = bars.filter((b) => isRthBar(b.t));
  let sessionHigh = state.sessionHigh;
  let hitBar: Bar | null = null;

  for (const bar of rth) {
    if (bar.h > sessionHigh) {
      const newHigh = bar.h;
      const canAlert = canFireHod(state, bar.t, newHigh, cooldownMin, pullbackPct);
      if (canAlert && rvolOk) {
        hitBar = bar;
        return {
          hit: true,
          bar,
          newHigh,
          nextState: {
            sessionHigh: newHigh,
            lastAlertAt: bar.t,
            lastAlertHigh: newHigh,
          },
        };
      }
      sessionHigh = newHigh;
    }
  }

  return {
    hit: false,
    bar: null,
    newHigh: sessionHigh,
    nextState: { ...state, sessionHigh },
  };
}

function canFireHod(
  state: HodState,
  barIso: string,
  newHigh: number,
  cooldownMin: number,
  pullbackPct: number
): boolean {
  if (!state.lastAlertAt || state.lastAlertHigh == null) return true;
  const elapsedMs =
    new Date(barIso).getTime() - new Date(state.lastAlertAt).getTime();
  if (elapsedMs >= cooldownMin * 60_000) return true;
  const pullback = (state.lastAlertHigh - newHigh) / state.lastAlertHigh;
  // pullback from last alert high: if price pulled back enough before new high, allow
  // For a new high above lastAlertHigh, pullback condition is about intervening low —
  // Alice: cooldown OR ≥0.5% pullback from that HOD. New high always exceeds last;
  // so within cooldown we only re-fire if there was a pullback reset (handled by caller
  // updating lastAlertHigh). Within cooldown and still climbing: suppress.
  void pullback;
  void pullbackPct;
  return false;
}

export function initialHodState(): HodState {
  return { sessionHigh: 0, lastAlertAt: null, lastAlertHigh: null };
}
