import { NextResponse } from 'next/server';
import {
  providerMeta,
  resolveDataProviderKind,
  hasVendorKeys,
} from '@/lib/data/provider';
import { isDbConfigured, dbStatusMessage } from '@/lib/db';
import { getSessionPhase, formatEtTime } from '@/lib/session';

/** Server-side only — ALPACA_* must be available (not Edge without env). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALPACA_LIVE_NOTE =
  'Alpaca Basic LIVE · SIP screener + IEX bars · ingen ordrer · float mangler';

export async function GET() {
  const kind = resolveDataProviderKind();
  const meta = providerMeta();
  const keysPresent = hasVendorKeys(kind);
  const forceExample =
    process.env.FORCE_EXAMPLE === '1' || process.env.FORCE_EXAMPLE === 'true';

  const dataSourceNote =
    meta.mode === 'LIVE' && kind === 'alpaca' && keysPresent
      ? ALPACA_LIVE_NOTE
      : meta.note;

  return NextResponse.json({
    ok: true,
    mode: meta.mode,
    provider: kind,
    keysPresent,
    forceExample,
    feedLabel:
      meta.mode === 'LIVE' && kind === 'alpaca' && keysPresent
        ? 'ALPACA · IEX bars + SIP screener (begrænset)'
        : meta.note,
    dataSourceNote,
    session: getSessionPhase(),
    lastUpdateEt: formatEtTime(),
    data: meta,
    dbConfigured: isDbConfigured(),
    dbStatus: dbStatusMessage(),
    worker: 'stub',
  });
}
