/**
 * DB access. Schema is ready in schema.sql.
 * Without DATABASE_URL / SUPABASE_DB_URL → not configured (loud, visible).
 */

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.POSTGRES_URL
  );
}

export function dbStatusMessage(): string {
  if (isDbConfigured()) return 'DB configured';
  return 'DB not configured';
}

/** Persist helper stub — M1 keeps alerts in-memory when DB missing. */
export async function withDb<T>(
  fn: (connString: string) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  const url =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    return { ok: false, reason: 'DB not configured' };
  }
  try {
    const value = await fn(url);
    return { ok: true, value };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'DB error',
    };
  }
}
