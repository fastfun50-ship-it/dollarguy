import { NextResponse } from 'next/server';
import { providerMeta } from '@/lib/data/provider';
import { isDbConfigured, dbStatusMessage } from '@/lib/db';
import { getSessionPhase, formatEtTime } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const meta = providerMeta();
  return NextResponse.json({
    ok: true,
    session: getSessionPhase(),
    lastUpdateEt: formatEtTime(),
    data: meta,
    dbConfigured: isDbConfigured(),
    dbStatus: dbStatusMessage(),
    worker: 'stub',
  });
}
