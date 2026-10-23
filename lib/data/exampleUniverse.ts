/**
 * EXAMPLE / DEMO synthetic universe only.
 * Fake tickers — never real symbols presented as live.
 * Marked EXAMPLE everywhere in UI/API.
 */

import type { Bar, Candidate, AlertEvent, SignalKind } from '../types';

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
  { symbol: 'EXMP', name: 'Example Corp.', prevClose: 5.42, float: 14_600_000, avgDailyVol20d: 1_000_000, avgSlot5m: 20_000, open0930: 6.08, pattern: 'hod' },
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

/** Build deterministic 1-min bars for a synthetic session day (RTH focus). */
export function buildExampleBars(seed: ExampleTickerSeed, sessionDate = '2026-10-23'): Bar[] {
  const bars: Bar[] = [];
  // Premarket 04:00–09:29 sparse
  let px = seed.prevClose * (1 + 0.02);
  for (let m = 4 * 60; m < 9 * 60 + 30; m += 5) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const t = `${sessionDate}T${hh}:${mm}:00-04:00`;
    const drift = (Math.sin(m / 17) + 1) * 0.002 * seed.prevClose;
    px = seed.prevClose + (seed.open0930 - seed.prevClose) * ((m - 240) / 330) + drift;
    bars.push({ t: new Date(t).toISOString(), o: px, h: px * 1.002, l: px * 0.998, c: px, v: 5_000 + (m % 7) * 800 });
  }

  // RTH 09:30–10:30 minute bars
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
      // Grind up; new highs after OR
      c = o + (i < 5 ? 0.02 : 0.04 + i * 0.005);
      v = i >= 10 ? 80_000 : 30_000;
      break;
    case 'orb':
      // Flat in OR, break above after minute 5
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
