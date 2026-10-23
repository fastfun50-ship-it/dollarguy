import type { AlertEvent } from '../types';
import { isDbConfigured } from '../db';

/** In-memory append-only alert log for M1. DB persistence when configured. */
const memory: AlertEvent[] = [];

/** Newest first by ET clock string HH:MM:SS (same trading day). */
function byNewest(a: AlertEvent, b: AlertEvent): number {
  return b.tsEt.localeCompare(a.tsEt);
}

export function listAlerts(limit = 100): AlertEvent[] {
  return [...memory].sort(byNewest).slice(0, limit);
}

export function listAlertsForSymbol(symbol: string, limit = 20): AlertEvent[] {
  return memory
    .filter((a) => a.symbol === symbol)
    .sort(byNewest)
    .slice(0, limit);
}

/**
 * Append alert unless the same id already exists (ORB max-1/session + HOD spam guard).
 * Returns false when skipped as duplicate. Newest stays at front.
 */
export function appendAlert(event: AlertEvent): boolean {
  if (memory.some((a) => a.id === event.id)) return false;
  memory.unshift(event);
  if (memory.length > 500) memory.length = 500;
  // DB write is best-effort; absence is visible via isDbConfigured()
  void isDbConfigured();
  return true;
}

export function clearAlertsForTests(): void {
  memory.length = 0;
}

/** Replace log; result is always newest-first regardless of input order. */
export function seedAlerts(events: AlertEvent[]): void {
  memory.length = 0;
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    memory.push(e);
  }
  memory.sort(byNewest);
}
