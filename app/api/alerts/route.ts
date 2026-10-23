import { NextResponse } from 'next/server';
import { listAlerts } from '@/lib/alerts/store';
import { isDbConfigured, dbStatusMessage } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    alerts: listAlerts(),
    dbConfigured: isDbConfigured(),
    dbStatus: dbStatusMessage(),
  });
}
