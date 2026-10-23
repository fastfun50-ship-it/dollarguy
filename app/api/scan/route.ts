import { NextRequest, NextResponse } from 'next/server';
import { runScan } from '@/lib/scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const empty = req.nextUrl.searchParams.get('empty') === '1';
  const down = req.nextUrl.searchParams.get('down') === '1';
  const result = await runScan({ empty, connectionDown: down });
  return NextResponse.json(result);
}
