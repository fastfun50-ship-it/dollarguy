import type { Bar } from '../types';
import { isRthBar } from '../session';

export interface HodState {
  sessionHigh: number;
  lastAlertAt: string | null;
  lastAlertHigh: number | null;
  /** Lowest low seen after lastAlertAt (for ≥pullbackPct reset). null until first post-alert bar. */
  lowSinceAlert: number | null;
}

/**
 * HOD: RTH [09:30,16:00) only. Premarket does not count.
 * Cooldown: 3 min after last alert OR ≥0.5% pullback from that HOD (via intervening low).
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
  let lastAlertAt = state.lastAlertAt;
  let lastAlertHigh = state.lastAlertHigh;
  let lowSinceAlert = state.lowSinceAlert;

  for (const bar of rth) {
    if (lastAlertAt != null) {
      const barMs = new Date(bar.t).getTime();
      const alertMs = new Date(lastAlertAt).getTime();
      if (barMs > alertMs) {
        lowSinceAlert =
          lowSinceAlert == null ? bar.l : Math.min(lowSinceAlert, bar.l);
      }
    }

    if (bar.h > sessionHigh) {
      const newHigh = bar.h;
      const canAlert = canFireHod(
        { lastAlertAt, lastAlertHigh, lowSinceAlert },
        bar.t,
        cooldownMin,
        pullbackPct
      );
      if (canAlert && rvolOk) {
        return {
          hit: true,
          bar,
          newHigh,
          nextState: {
            sessionHigh: newHigh,
            lastAlertAt: bar.t,
            lastAlertHigh: newHigh,
            lowSinceAlert: null,
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
    nextState: {
      sessionHigh,
      lastAlertAt,
      lastAlertHigh,
      lowSinceAlert,
    },
  };
}

function canFireHod(
  state: {
    lastAlertAt: string | null;
    lastAlertHigh: number | null;
    lowSinceAlert: number | null;
  },
  barIso: string,
  cooldownMin: number,
  pullbackPct: number
): boolean {
  if (!state.lastAlertAt || state.lastAlertHigh == null) return true;
  const elapsedMs =
    new Date(barIso).getTime() - new Date(state.lastAlertAt).getTime();
  if (elapsedMs >= cooldownMin * 60_000) return true;
  // ≥pullbackPct drop from lastAlertHigh via intervening low → allow re-fire
  if (
    state.lowSinceAlert != null &&
    (state.lastAlertHigh - state.lowSinceAlert) / state.lastAlertHigh >=
      pullbackPct
  ) {
    return true;
  }
  return false;
}

export function initialHodState(): HodState {
  return {
    sessionHigh: 0,
    lastAlertAt: null,
    lastAlertHigh: null,
    lowSinceAlert: null,
  };
}
