import {
  DEFAULT_FILTERS,
  type AlertEvent,
  type Candidate,
  type ScanStatus,
  type SignalKind,
  type TickerDetail,
} from './types';
import { getSessionPhase, formatEtTime, isRthBar } from './session';
import { isDbConfigured } from './db';
import { getMarketDataProvider, providerMeta } from './data/provider';
import { passesUniverseFilters } from './filters';
import {
  chgClosePct,
  gapOpenPct,
  rvolDay,
  rvol5m,
  detectOrbBreak,
  detectHod,
  initialHodState,
  detectRunningUp,
  relVolSpike,
  computeOpeningRange,
} from './signals';
import type { HodState } from './signals';
import { EXAMPLE_CLOCK, EXMP_SNAPSHOT, exampleSignalTag } from './data/exampleUniverse';
import { appendAlert, listAlerts, listAlertsForSymbol, seedAlerts } from './alerts/store';

/**
 * Persistent HOD state per symbol across runScan calls (same Node process).
 * M1: in-memory only — not shared across serverless instances; reset via clearHodStatesForTests.
 * Cleared automatically when the America/New_York trading calendar day changes.
 */
const hodStateBySymbol = new Map<string, HodState>();
let hodStateDayEt: string | null = null;

function etTradingDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Reset HOD map when ET calendar day rolls (Alice residual). */
export function ensureHodStateTradingDay(d: Date = new Date()): void {
  const day = etTradingDay(d);
  if (hodStateDayEt !== day) {
    hodStateBySymbol.clear();
    hodStateDayEt = day;
  }
}

export function clearHodStatesForTests(): void {
  hodStateBySymbol.clear();
  hodStateDayEt = null;
}

function vwapFromBars(bars: { c: number; v: number; h: number; l: number }[]): number | null {
  let pv = 0;
  let vol = 0;
  for (const b of bars) {
    const typical = (b.h + b.l + b.c) / 3;
    pv += typical * b.v;
    vol += b.v;
  }
  return vol > 0 ? pv / vol : null;
}

function ageMinutes(bars: { t: string }[], fromIndex = 0): number {
  if (!bars.length) return 0;
  const first = new Date(bars[fromIndex]?.t ?? bars[0].t).getTime();
  const last = new Date(bars[bars.length - 1].t).getTime();
  return Math.max(0, Math.round((last - first) / 60_000));
}

/** EXAMPLE mode uses pinned story clock so status matches chart 09:30–09:42. */
function exampleClock(): Date {
  return EXAMPLE_CLOCK;
}

function statusClock(mode: ScanStatus['mode']): Date {
  return mode === 'EXAMPLE' ? exampleClock() : new Date();
}

function applyExmpDisplay(
  symbol: string,
  mode: ScanStatus['mode'],
  metrics: {
    last: number;
    prevClose: number;
    chg: number;
    gap: number;
    rd: number;
    r5: number;
    volume: number;
  }
): { chg: number; chgAbs: number; gap: number; rd: number; r5: number; volume: number } {
  if (symbol === 'EXMP' && mode === 'EXAMPLE') {
    return {
      chg: EXMP_SNAPSHOT.chgClosePct,
      chgAbs: EXMP_SNAPSHOT.chgAbs,
      gap: EXMP_SNAPSHOT.gapPct,
      rd: EXMP_SNAPSHOT.rvolDay,
      r5: EXMP_SNAPSHOT.rvol5m,
      volume: EXMP_SNAPSHOT.volume,
    };
  }
  return {
    chg: metrics.chg,
    chgAbs: Number((metrics.last - metrics.prevClose).toFixed(2)),
    gap: metrics.gap,
    rd: metrics.rd,
    r5: metrics.r5,
    volume: metrics.volume,
  };
}

export async function runScan(opts?: {
  empty?: boolean;
  connectionDown?: boolean;
}): Promise<{ status: ScanStatus; candidates: Candidate[]; alerts: AlertEvent[] }> {
  ensureHodStateTradingDay();
  const meta = providerMeta();
  const clock = statusClock(meta.mode);
  const session = meta.mode === 'EXAMPLE' ? getSessionPhase(clock) : getSessionPhase();

  if (opts?.connectionDown) {
    return {
      status: {
        mode: meta.mode,
        session,
        feed: 'DOWN',
        feedLabel: 'forbindelse ned',
        lastUpdateEt: meta.mode === 'EXAMPLE' ? EXMP_SNAPSHOT.lastUpdateEt : formatEtTime(clock),
        dbConfigured: isDbConfigured(),
        ws: 'DOWN',
        message: 'Forbindelse til datafeed er nede.',
      },
      candidates: [],
      alerts: listAlerts(),
    };
  }

  const provider = getMarketDataProvider();

  let universe;
  try {
    universe = await provider.listUniverse();
  } catch (e) {
    return {
      status: {
        mode: meta.mode,
        session,
        feed: 'NOT_CONFIGURED',
        feedLabel: provider.feedLabel,
        lastUpdateEt: meta.mode === 'EXAMPLE' ? EXMP_SNAPSHOT.lastUpdateEt : formatEtTime(clock),
        dbConfigured: isDbConfigured(),
        ws: 'DOWN',
        message: e instanceof Error ? e.message : 'Datafejl',
      },
      candidates: [],
      alerts: listAlerts(),
    };
  }

  if (opts?.empty) {
    return {
      status: {
        mode: provider.mode,
        session,
        feed: provider.feedStatus,
        feedLabel: provider.feedLabel,
        lastUpdateEt: provider.mode === 'EXAMPLE' ? EXMP_SNAPSHOT.lastUpdateEt : formatEtTime(clock),
        dbConfigured: isDbConfigured(),
        ws: provider.mode === 'EXAMPLE' ? 'STUB' : 'OK',
        message: 'Ingen tickers matcher filtre',
      },
      candidates: [],
      alerts: listAlerts(),
    };
  }

  const candidates: Candidate[] = [];
  const newAlerts: AlertEvent[] = [];

  for (const snap of universe) {
    if (!passesUniverseFilters(snap)) continue;

    const gapRaw = gapOpenPct(snap.open0930, snap.prevClose);
    const chgRaw = chgClosePct(snap.last, snap.prevClose);
    const rdRaw = rvolDay(snap.bars, snap.avgDailyVol20d);
    const r5Raw = rvol5m(
      snap.bars.filter((_, i, a) => i < a.length),
      snap.avgSlot5m
    );
    const disp = applyExmpDisplay(snap.symbol, provider.mode, {
      last: snap.last,
      prevClose: snap.prevClose,
      chg: chgRaw,
      gap: gapRaw,
      rd: rdRaw,
      r5: r5Raw,
      volume: snap.volume,
    });
    const gap = disp.gap;
    const chg = disp.chg;
    const rd = disp.rd;
    const r5 = disp.r5;

    const orb = detectOrbBreak(snap.bars, DEFAULT_FILTERS.orbN);
    // Walk HOD with cooldown/pullback so alerts include later highs (e.g. EXMP 6.42 @ 09:42).
    let hodWalk = initialHodState();
    let hodHits = 0;
    const hodOpts = {
      cooldownMin: DEFAULT_FILTERS.hodCooldownMin,
      pullbackPct: DEFAULT_FILTERS.hodPullbackPct,
      rvol5m: r5Raw,
      rvolMin: DEFAULT_FILTERS.rvol5Min,
    };
    for (let guard = 0; guard < 32; guard++) {
      const step = detectHod(snap.bars, hodWalk, hodOpts);
      hodWalk = step.nextState;
      if (!step.hit || !step.bar) break;
      hodHits += 1;
      newAlerts.push({
        id: `${snap.symbol}-HOD-${step.bar.t}`,
        tsEt: formatEtFromIso(step.bar.t),
        symbol: snap.symbol,
        kind: 'HOD',
        message: `HOD — ny intraday high ${step.newHigh.toFixed(2)}`,
        price: step.newHigh,
      });
    }
    hodStateBySymbol.set(snap.symbol, hodWalk);
    // ORB alert whenever break fires (even if primary signal is HOD) — EXMP story ORB5@09:36
    if (orb.hit && orb.bar) {
      newAlerts.push({
        id: `${snap.symbol}-ORB-${orb.bar.t}`,
        tsEt: formatEtFromIso(orb.bar.t),
        symbol: snap.symbol,
        kind: 'ORB5',
        message: `ORB5 break — close > OR high`,
        price: orb.bar.c,
      });
    }
    const run = detectRunningUp(snap.bars, {
      k: DEFAULT_FILTERS.runK,
      x: DEFAULT_FILTERS.runX,
    });
    const volSpike = relVolSpike(r5Raw, 5);

    let signal: SignalKind | null = null;
    const why: string[] = [];
    const rthHighs = snap.bars.filter((b) => isRthBar(b.t)).map((b) => b.h);
    const sessionHod = rthHighs.length ? Math.max(...rthHighs) : 0;
    const lastBar = snap.bars[snap.bars.length - 1];

    if (hodHits > 0 || (snap.seed?.pattern === 'hod' && sessionHod > 0)) {
      signal = 'HOD';
      why.push(`HOD — ny intraday high ${sessionHod.toFixed(2)}`);
    } else if (orb.hit && orb.bar) {
      signal = 'ORB5';
      why.push(`ORB5 break — close > OR high ${orb.orHigh.toFixed(2)}`);
    } else if (run.hit && run.bar) {
      signal = 'RUN';
      why.push(`Running Up — +${(run.pct * 100).toFixed(1)}% / ${DEFAULT_FILTERS.runK}m`);
      newAlerts.push({
        id: `${snap.symbol}-RUN-${run.bar.t}`,
        tsEt: formatEtFromIso(run.bar.t),
        symbol: snap.symbol,
        kind: 'RUN',
        message: `Running Up — +${(run.pct * 100).toFixed(1)}% / ${DEFAULT_FILTERS.runK}m`,
        price: run.bar.c,
      });
    } else if (volSpike) {
      signal = 'VS';
      why.push(`Volumen spike — RVol5 ${r5.toFixed(1)}×`);
      newAlerts.push({
        id: `${snap.symbol}-VS-${lastBar?.t ?? 'vs'}`,
        tsEt: lastBar ? formatEtFromIso(lastBar.t) : EXMP_SNAPSHOT.lastUpdateEt,
        symbol: snap.symbol,
        kind: 'VS',
        message: `Volumen spike — RVol5 ${r5.toFixed(1)}×`,
        price: snap.last,
      });
    } else if (snap.seed) {
      signal = exampleSignalTag(snap.seed.pattern);
    } else {
      signal = 'GAP';
    }

    // EXMP story: explicit mid-session VS alert (Alma ticker alerts 09:37:14)
    if (snap.symbol === 'EXMP' && provider.mode === 'EXAMPLE') {
      newAlerts.push({
        id: 'EXMP-VS-093714',
        tsEt: '09:37:14',
        symbol: 'EXMP',
        kind: 'VS',
        message: 'Volumen spike RVol5 5.4×',
        price: 6.18,
      });
    }

    why.push(`RVol5 ${r5.toFixed(1)}× · Gap ${(gap * 100).toFixed(1)}%`);
    why.push(
      `Pris $${snap.last.toFixed(2)} i $${DEFAULT_FILTERS.priceMin}–${DEFAULT_FILTERS.priceMax} · Float ${(snap.float / 1e6).toFixed(1)}M`
    );

    candidates.push({
      symbol: snap.symbol,
      name: snap.name,
      last: snap.last,
      chgClosePct: chg,
      chgAbs: disp.chgAbs,
      gapPct: gap,
      rvolDay: rd,
      rvol5m: r5,
      volume: disp.volume,
      float: snap.float,
      signal,
      ageMin: ageMinutes(snap.bars),
      why,
    });
  }

  candidates.sort((a, b) => b.gapPct - a.gapPct);

  // Seed alert log once per process if empty
  if (listAlerts().length === 0 && newAlerts.length > 0) {
    seedAlerts(newAlerts);
  } else {
    for (const a of newAlerts) appendAlert(a);
  }

  return {
    status: {
      mode: provider.mode,
      session,
      feed: provider.feedStatus,
      feedLabel: provider.feedLabel,
      lastUpdateEt:
        provider.mode === 'EXAMPLE' ? EXMP_SNAPSHOT.lastUpdateEt : formatEtTime(clock),
      dbConfigured: isDbConfigured(),
      ws: provider.mode === 'EXAMPLE' ? 'STUB' : 'OK',
      message:
        provider.mode === 'EXAMPLE'
          ? 'EXAMPLE DATA — ikke live markedsdata. Vendor-keys mangler / ikke godkendt.'
          : undefined,
    },
    candidates,
    alerts: listAlerts(),
  };
}

export async function getTickerDetail(symbol: string): Promise<TickerDetail | null> {
  const provider = getMarketDataProvider();
  let universe;
  try {
    universe = await provider.listUniverse();
  } catch {
    return null;
  }
  const snap = universe.find((u) => u.symbol === symbol);
  if (!snap) return null;

  const scan = await runScan();
  const candidate =
    scan.candidates.find((c) => c.symbol === symbol) ||
    ({
      symbol: snap.symbol,
      name: snap.name,
      last: snap.last,
      chgClosePct: chgClosePct(snap.last, snap.prevClose),
      chgAbs: Number((snap.last - snap.prevClose).toFixed(2)),
      gapPct: gapOpenPct(snap.open0930, snap.prevClose),
      rvolDay: rvolDay(snap.bars, snap.avgDailyVol20d),
      rvol5m: rvol5m(snap.bars, snap.avgSlot5m),
      volume: snap.volume,
      float: snap.float,
      signal: null,
      ageMin: 0,
      why: ['Matcher ikke aktive filtre'],
    } satisfies Candidate);

  const or = computeOpeningRange(snap.bars, DEFAULT_FILTERS.orbN);

  // Chart bars: RTH-first for readable OR/HOD story; fall back to last 60.
  const rthBars = snap.bars.filter((b) => isRthBar(b.t));
  const chartBars = (rthBars.length ? rthBars : snap.bars).slice(-60);
  let vwap = vwapFromBars(chartBars);
  // Alma locked EXAMPLE snapshot: EXMP VWAP 5.78 (display contract)
  if (snap.symbol === 'EXMP' && provider.mode === 'EXAMPLE') {
    vwap = EXMP_SNAPSHOT.vwap;
  }
  return {
    candidate,
    bars: chartBars,
    vwap,
    orHigh: or.ready ? or.high : null,
    orLow: or.ready ? or.low : null,
    alerts: listAlertsForSymbol(symbol),
    news:
      provider.mode === 'EXAMPLE'
        ? [
            { when: '09:28', headline: 'Eksempeloverskrift — fiktiv katalysator (ingen live nyhed).' },
            { when: '08:55', headline: 'Premarket note: EXAMPLE DATA only.' },
          ]
        : [],
  };
}

function formatEtFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
