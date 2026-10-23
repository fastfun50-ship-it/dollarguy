/** Premarket gap: (pm_last - prev_close) / prev_close */
export function gapPmPct(pmLast: number, prevClose: number): number {
  if (!prevClose) return 0;
  return (pmLast - prevClose) / prevClose;
}

/** Gap open (locks after 09:30): (open_0930 - prev_close) / prev_close */
export function gapOpenPct(open0930: number, prevClose: number): number {
  if (!prevClose) return 0;
  return (open0930 - prevClose) / prevClose;
}

export function chgClosePct(last: number, prevClose: number): number {
  if (!prevClose) return 0;
  return (last - prevClose) / prevClose;
}
