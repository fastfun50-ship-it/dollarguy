import type { SessionPhase } from './types';

const ET = 'America/New_York';

/** Format a Date as HH:MM:SS in America/New_York. */
export function formatEtTime(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ET,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/** Minutes since midnight ET for a given Date. */
export function minutesSinceMidnightEt(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  // en-US hour12:false can emit 24 for midnight — normalize
  const h = hour === 24 ? 0 : hour;
  return h * 60 + minute;
}

/**
 * US equity session phase in America/New_York.
 * PRE 04:00–09:30, RTH 09:30–16:00, AH 16:00–20:00, else CLOSED.
 */
export function getSessionPhase(d: Date = new Date()): SessionPhase {
  const m = minutesSinceMidnightEt(d);
  if (m >= 4 * 60 && m < 9 * 60 + 30) return 'PRE';
  if (m >= 9 * 60 + 30 && m < 16 * 60) return 'RTH';
  if (m >= 16 * 60 && m < 20 * 60) return 'AH';
  return 'CLOSED';
}

/** True if timestamp (ISO) falls in RTH [09:30, 16:00) ET on its calendar day. */
export function isRthBar(iso: string): boolean {
  const d = new Date(iso);
  const m = minutesSinceMidnightEt(d);
  return m >= 9 * 60 + 30 && m < 16 * 60;
}

/** True if bar is inside opening-range half-open window [09:30, 09:30+N). */
export function isInOpeningRange(iso: string, orbN = 5): boolean {
  const m = minutesSinceMidnightEt(new Date(iso));
  const start = 9 * 60 + 30;
  return m >= start && m < start + orbN;
}

/** Weekday 1–5 Mon–Fri in ET (rough; no NYSE holiday calendar in M1). */
export function isWeekdayEt(d: Date = new Date()): boolean {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    weekday: 'short',
  }).format(d);
  return !['Sat', 'Sun'].includes(wd);
}

/** YYYY-MM-DD in America/New_York. */
export function etCalendarDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * ISO UTC for a wall-clock time on the current ET calendar day.
 * Picks -04:00 vs -05:00 so the instant maps back to the requested ET clock.
 */
export function etWallTimeToUtcIso(
  hour: number,
  minute: number,
  d: Date = new Date()
): string {
  const ymd = etCalendarDate(d);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  for (const off of ['-04:00', '-05:00'] as const) {
    const cand = new Date(`${ymd}T${hh}:${mm}:00${off}`);
    if (Number.isNaN(cand.getTime())) continue;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ET,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(cand);
    let h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === 24) h = 0;
    if (h === hour && m === minute) return cand.toISOString();
  }
  return new Date(`${ymd}T${hh}:${mm}:00-04:00`).toISOString();
}

/** RTH open 09:30 ET today — default `start` for IEX 1Min bars. */
export function etSessionStartIso(d: Date = new Date()): string {
  return etWallTimeToUtcIso(9, 30, d);
}
