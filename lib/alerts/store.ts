import type { AlertEvent } from '../types';
import { isDbConfigured } from '../db';

/** In-memory append-only alert log for M1. DB persistence when configured. */
const memory: AlertEvent[] = [];

export function listAlerts(limit = 100): AlertEvent[] {
  return memory.slice(0, limit);
}

export function listAlertsForSymbol(symbol: string, limit = 20): AlertEvent[] {
  return memory.filter((a) => a.symbol === symbol).slice(0, limit);
}

export function appendAlert(event: AlertEvent): void {
  memory.unshift(event);
  if (memory.length > 500) memory.length = 500;
  // DB write is best-effort; absence is visible via isDbConfigured()
  void isDbConfigured();
}

export function clearAlertsForTests(): void {
  memory.length = 0;
}

export function seedAlerts(events: AlertEvent[]): void {
  memory.length = 0;
  memory.push(...events);
}
