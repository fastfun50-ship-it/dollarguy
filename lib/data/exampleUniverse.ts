/**
 * EXAMPLE / DEMO synthetic universe only.
 * Fake tickers — never real symbols presented as live.
 * Marked EXAMPLE everywhere in UI/API.
 *
 * EXMP bars are a locked coherent story (Alma CHART-DESIGN-NOTE §9):
 * gap → OR 5.46–6.12 → ORB5 @ ~09:36 → HOD 6.42 @ 09:42 · VWAP ~5.78
 */

import type { Bar, SignalKind } from '../types';

export interface ExampleTickerSeed {
  symbol: string;
  name: string;
  prevClose: number;
  float: number;
  avgDailyVol20d: number;
  /** Average volume for a 5-min slot used in rvol_5m. */
  avgSlot5m: number;
  open0930: number;
  /** Pattern that drives deterministic signals. */
  pattern: 'hod' | 'orb' | 'run' | 'gap' | 'vol';
}

export const EXAMPLE_TICKERS: ExampleTickerSeed[] = [
  {
    symbol: 'EXMP',
    name: 'Example Corp.',
    prevClose: 5.43,
    float: 14_600_000,
    avgDailyVol20d: 1_000_000,
    avgSlot5m: 20_000,
    open0930: 6.087,
    pattern: 'hod',
  },
  { symbol: 'DEMO', name: 'Demo Holdings', prevClose: 2.81, float: 8_100_000, avgDailyVol20d: 600_000, avgSlot5m: 15_000, open0930: 3.21, pattern: 'run' },
  { symbol: 'TEST', name: 'Test Instruments', prevClose: 2.62, float: 6_200_000, avgDailyVol20d: 570_000, avgSlot5m: 12_000, open0930: 2.75, pattern: 'orb' },
  { symbol: 'SIMX', name: 'Simulated X', prevClose: 10.22, float: 18_000_000, avgDailyVol20d: 570_000, avgSlot5m: 18_000, open0930: 11.05, pattern: 'vol' },
  { symbol: 'MOCK', name: 'Mock Industries', prevClose: 4.24, float: 11_300_000, avgDailyVol20d: 1_400_000, avgSlot5m: 16_000, open0930: 4.55, pattern: 'hod' },
  { symbol: 'ALFA', name: 'Alfa Demo', prevClose: 1.67, float: 4_500_000, avgDailyVol20d: 640_000, avgSlot5m: 10_000, open0930: 1.78, pattern: 'run' },
  { symbol: 'BRAV', name: 'Bravo Sample', prevClose: 7.96, float: 19_200_000, avgDailyVol20d: 690_000, avgSlot5m: 14_000, open0930: 8.40, pattern: 'gap' },
  { symbol: 'CHRT', name: 'Chart Fiction', prevClose: 4.87, float: 15_000_000, avgDailyVol20d: 650_000, avgSlot5m: 11_000, open0930: 5.00, pattern: 'orb' },
  { symbol: 'NOVA', name: 'Nova Example', prevClose: 6.63, float: 9_800_000, avgDailyVol20d: 820_000, avgSlot5m: 13_000, open0930: 6.92, pattern: 'vol' },
  { symbol: 'PULS', name: 'Pulse Demo', prevClose: 2.07, float: 7_000_000, avgDailyVol20d: 690_000, avgSlot5m: 9_000, open0930: 2.15, pattern: 'gap' },
];

/** Locked EXMP 1m RTH story 09:30–09:42 ET (CHART-DESIGN-NOTE §9). */
function buildExmpBars(sessionDate: string): Bar[] {
  // Premarket sparse (for completeness)
  const bars: Bar[] = [];
  let px = 5.55;
  for (let m = 4 * 60; m < 9 * 60 + 30; m += 5) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const t = `${sessionDate}T${hh}:${mm}:00-04:00`;
    px = 5.43 + (6.08 - 5.43) * ((m - 240) / 330);
    bars.push({
      t: new Date(t).toISOString(),
      o: px,
      h: px * 1.002,
      l: px * 0.998,
      c: px,
      // Heavy PM volume near mid-gap keeps session VWAP near Alma target 5.78
      v: 180_000 + (m % 7) * 20_000,
    });
  }

  // RTH 1m bars — explicit OHLC so OR / ORB / HOD / VWAP stay coherent
  // minutes 0–4 = OR window [09:30, 09:35): range 5.46–6.12
  const rth: Array<{ o: number; h: number; l: number; c: number; v: number }> = [
    // OR — high volume at lows pulls VWAP toward ~5.78
    { o: 6.087, h: 6.10, l: 5.90, c: 5.95, v: 220_000 }, // 09:30
    { o: 5.95, h: 6.12, l: 5.88, c: 6.05, v: 180_000 }, // 09:31 — OR high 6.12
    { o: 6.05, h: 6.08, l: 5.70, c: 5.75, v: 260_000 }, // 09:32
    { o: 5.75, h: 5.85, l: 5.46, c: 5.60, v: 420_000 }, // 09:33 — OR low 5.46
    { o: 5.60, h: 5.95, l: 5.55, c: 5.88, v: 300_000 }, // 09:34
    // ORB5 break ~09:35–09:36 (close > OR high 6.12)
    { o: 5.88, h: 6.18, l: 5.85, c: 6.15, v: 140_000 }, // 09:35
    { o: 6.15, h: 6.22, l: 6.10, c: 6.20, v: 120_000 }, // 09:36 ORB5
    { o: 6.20, h: 6.24, l: 6.12, c: 6.18, v: 70_000 }, // 09:37
    { o: 6.18, h: 6.28, l: 6.16, c: 6.26, v: 65_000 }, // 09:38
    { o: 6.26, h: 6.30, l: 6.20, c: 6.22, v: 55_000 }, // 09:39 red pullback
    { o: 6.22, h: 6.35, l: 6.21, c: 6.33, v: 80_000 }, // 09:40
    { o: 6.33, h: 6.38, l: 6.30, c: 6.36, v: 90_000 }, // 09:41
    { o: 6.36, h: 6.42, l: 6.34, c: 6.42, v: 160_000 }, // 09:42 HOD 6.42
  ];

  for (let i = 0; i < rth.length; i++) {
    const totalMin = 9 * 60 + 30 + i;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    const t = `${sessionDate}T${hh}:${mm}:00-04:00`;
    const b = rth[i];
    bars.push({ t: new Date(t).toISOString(), ...b });
  }
  return bars;
}

/** Build deterministic 1-min bars for a synthetic session day (RTH focus). */
export function buildExampleBars(seed: ExampleTickerSeed, sessionDate = '2026-10-23'): Bar[] {
  if (seed.symbol === 'EXMP') return buildExmpBars(sessionDate);

  const bars: Bar[] = [];
  let px = seed.prevClose * (1 + 0.02);
  for (let m = 4 * 60; m < 9 * 60 + 30; m += 5) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const t = `${sessionDate}T${hh}:${mm}:00-04:00`;
    const drift = (Math.sin(m / 17) + 1) * 0.002 * seed.prevClose;
    px = seed.prevClose + (seed.open0930 - seed.prevClose) * ((m - 240) / 330) + drift;
    bars.push({
      t: new Date(t).toISOString(),
      o: px,
      h: px * 1.002,
      l: px * 0.998,
      c: px,
      v: 5_000 + (m % 7) * 800,
    });
  }

  px = seed.open0930;
  let high = px;
  for (let i = 0; i < 60; i++) {
    const totalMin = 9 * 60 + 30 + i;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    const t = `${sessionDate}T${hh}:${mm}:00-04:00`;
    const { o, h, l, c, v } = nextBar(seed, i, px, high);
    px = c;
    high = Math.max(high, h);
    bars.push({ t: new Date(t).toISOString(), o, h, l, c, v });
  }
  return bars;
}

function nextBar(
  seed: ExampleTickerSeed,
  i: number,
  prevClose: number,
  sessionHigh: number
): { o: number; h: number; l: number; c: number; v: number } {
  const o = prevClose;
  let c = prevClose;
  let v = 25_000 + i * 400;

  switch (seed.pattern) {
    case 'hod':
      c = o + (i < 5 ? 0.02 : 0.04 + i * 0.005);
      v = i >= 10 ? 80_000 : 30_000;
      break;
    case 'orb':
      if (i < 5) c = o + (i % 2 === 0 ? 0.01 : -0.01);
      else c = seed.open0930 + 0.15 + (i - 5) * 0.02;
      break;
    case 'run':
      if (i >= 5 && i < 12) c = o + 0.03;
      else c = o + 0.005;
      v = i >= 5 && i < 12 ? 90_000 : 20_000;
      break;
    case 'vol':
      c = o + 0.01;
      v = i >= 8 ? 120_000 : 20_000;
      break;
    case 'gap':
    default:
      c = o + (i % 3 === 0 ? 0.01 : -0.005);
      break;
  }

  const h = Math.max(o, c, sessionHigh * (i > 10 && seed.pattern === 'hod' ? 1.001 : 1)) + 0.01;
  const l = Math.min(o, c) - 0.01;
  return { o, h, l, c, v };
}

export function exampleSignalTag(pattern: ExampleTickerSeed['pattern']): SignalKind {
  switch (pattern) {
    case 'hod':
      return 'HOD';
    case 'orb':
      return 'ORB5';
    case 'run':
      return 'RUN';
    case 'vol':
      return 'VS';
    default:
      return 'GAP';
  }
}
