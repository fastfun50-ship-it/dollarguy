/** Shared domain types for DollarGuy M1 scanner. */

export type DataMode = 'EXAMPLE' | 'LIVE' | 'DELAYED';
export type SessionPhase = 'PRE' | 'RTH' | 'AH' | 'CLOSED';
export type FeedStatus = 'OK' | 'DOWN' | 'STALE' | 'NOT_CONFIGURED';

export type SignalKind =
  | 'GAP'
  | 'HOD'
  | 'ORB5'
  | 'RUN'
  | 'VS'
  | 'RVOL';

export interface Bar {
  /** ISO timestamp in UTC; session math uses America/New_York. */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface FilterDefaults {
  priceMin: number;
  priceMax: number;
  gapMinPct: number;
  floatMax: number;
  rvol5Min: number;
  /** Opening range length in minutes (default 5). */
  orbN: number;
  hodCooldownMin: number;
  hodPullbackPct: number;
  runK: number;
  runX: number;
}

export const DEFAULT_FILTERS: FilterDefaults = {
  priceMin: 1,
  priceMax: 20,
  gapMinPct: 0.04,
  floatMax: 20_000_000,
  rvol5Min: 2,
  orbN: 5,
  hodCooldownMin: 3,
  hodPullbackPct: 0.005,
  runK: 5,
  runX: 0.05,
};

export interface Candidate {
  symbol: string;
  name: string;
  last: number;
  chgClosePct: number;
  /** Absolute change last − prevClose (EXMP: +0.99). */
  chgAbs: number;
  gapPct: number;
  rvolDay: number;
  rvol5m: number;
  volume: number;
  float: number;
  signal: SignalKind | null;
  ageMin: number;
  why: string[];
}

export interface AlertEvent {
  id: string;
  tsEt: string;
  symbol: string;
  kind: SignalKind;
  message: string;
  price: number;
}

export interface ScanStatus {
  mode: DataMode;
  session: SessionPhase;
  feed: FeedStatus;
  feedLabel: string;
  lastUpdateEt: string;
  dbConfigured: boolean;
  ws: 'OK' | 'DOWN' | 'STUB';
  message?: string;
}

export interface TickerDetail {
  candidate: Candidate;
  bars: Bar[];
  vwap: number | null;
  orHigh: number | null;
  orLow: number | null;
  alerts: AlertEvent[];
  news: { when: string; headline: string }[];
}
