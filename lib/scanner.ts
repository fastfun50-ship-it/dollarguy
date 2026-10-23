import {
  DEFAULT_FILTERS,
  type AlertEvent,
  type Candidate,
  type ScanStatus,
  type SignalKind,
  type TickerDetail,
} from './types';
import { getSessionPhase, formatEtTime } from './session';
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
import { exampleSignalTag } from './data/exampleUniverse';
import { appendAlert, listAlerts, listAlertsForSymbol, seedAlerts } from './alerts/store';

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

export async function runScan(opts?: {
  empty?: boolean;
  connectionDown?: boolean;
}): Promise<{ status: ScanStatus; candidates: Candidate[]; alerts: AlertEvent[] }> {
  const meta = providerMeta();
  const session = getSessionPhase();

  if (opts?.connectionDown) {
    return {
      status: {
        mode: meta.mode,
        session,
        feed: 'DOWN',
        feedLabel: 'forbindelse ned',
        lastUpdateEt: formatEtTime(),
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
        lastUpdateEt: formatEtTime(),
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
        lastUpdateEt: formatEtTime(),
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

    const gap = gapOpenPct(snap.open0930, snap.prevClose);
    const chg = chgClosePct(snap.last, snap.prevClose);
    const rd = rvolDay(snap.bars, snap.avgDailyVol20d);
    const r5 = rvol5m(snap.bars.filter((_, i, a) => i < a.length), snap.avgSlot5m);

    const orb = detectOrbBreak(snap.bars, DEFAULT_FILTERS.orbN);
    const hod = detectHod(snap.bars, initialHodState(), {
      cooldownMin: DEFAULT_FILTERS.hodCooldownMin,
      pullbackPct: DEFAULT_FILTERS.hodPullbackPct,
      rvol5m: r5,
      rvolMin: DEFAULT_FILTERS.rvol5Min,
    });
    const run = detectRunningUp(snap.bars, {
      k: DEFAULT_FILTERS.runK,
      x: DEFAULT_FILTERS.runX,
    });
    const volSpike = relVolSpike(r5, 5);

    let signal: SignalKind | null = null;
    const why: string[] = [];

    if (hod.hit && hod.bar) {
      signal = 'HOD';
      why.push(`HOD — ny intraday high ${hod.newHigh.toFixed(2)}`);
      newAlerts.push({
        id: `${snap.symbol}-HOD-${hod.bar.t}`,
        tsEt: formatEtFromIso(hod.bar.t),
        symbol: snap.symbol,
        kind: 'HOD',
        message: `HOD — ny intraday high ${hod.newHigh.toFixed(2)}`,
        price: hod.newHigh,
      });
    } else if (orb.hit && orb.bar) {
      signal = 'ORB5';
      why.push(`ORB5 break — close > OR high ${orb.orHigh.toFixed(2)}`);
      newAlerts.push({
        id: `${snap.symbol}-ORB-${orb.bar.t}`,
        tsEt: formatEtFromIso(orb.bar.t),
        symbol: snap.symbol,
        kind: 'ORB5',
        message: `ORB5 break — close > OR high`,
        price: orb.bar.c,
      });
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
        id: `${snap.symbol}-VS`,
        tsEt: formatEtTime(),
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

    why.push(`RVol5 ${r5.toFixed(1)}× · Gap ${(gap * 100).toFixed(1)}%`);
    why.push(
      `Pris $${snap.last.toFixed(2)} i $${DEFAULT_FILTERS.priceMin}–${DEFAULT_FILTERS.priceMax} · Float ${(snap.float / 1e6).toFixed(1)}M`
    );

    candidates.push({
      symbol: snap.symbol,
      name: snap.name,
      last: snap.last,
      chgClosePct: chg,
      gapPct: gap,
      rvolDay: rd,
      rvol5m: r5,
      volume: snap.volume,
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
      lastUpdateEt: formatEtTime(),
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

  return {
    candidate,
    bars: snap.bars.filter((b) => {
      // show RTH-ish for chart
      const h = new Date(b.t).getUTCHours(); // rough; bars already ET-offset encoded
      return true;
    }).slice(-60),
    vwap: vwapFromBars(snap.bars),
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
