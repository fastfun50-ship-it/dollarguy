import { DEFAULT_FILTERS, type FilterDefaults } from './types';
import { gapOpenPct, chgClosePct } from './signals';

export type SnapshotLike = {
  last: number;
  prevClose: number;
  open0930: number;
  /** null = float unknown — do NOT treat as 0 (would silently pass floatMax). */
  float: number | null;
};

export function passesUniverseFilters(
  s: SnapshotLike,
  f: FilterDefaults = DEFAULT_FILTERS
): boolean {
  if (s.last < f.priceMin || s.last > f.priceMax) return false;
  // Float unknown → skip float filter (loud: UI shows ukendt; filter chip notes inactive).
  if (s.float != null && s.float > f.floatMax) return false;
  const gap = gapOpenPct(s.open0930, s.prevClose);
  if (gap < f.gapMinPct) return false;
  return true;
}

export { DEFAULT_FILTERS, gapOpenPct, chgClosePct };
