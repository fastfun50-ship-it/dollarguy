import { NextRequest, NextResponse } from 'next/server';
import { getTickerDetail } from '@/lib/scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: { sym: string } }
) {
  const sym = decodeURIComponent(ctx.params.sym).toUpperCase();
  try {
    const detail = await getTickerDetail(sym);
    if (!detail) {
      return NextResponse.json(
        { error: 'Ticker ikke fundet i universe', symbol: sym, kind: 'not_found' },
        { status: 404 }
      );
    }
    return NextResponse.json(detail);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message, symbol: sym, kind: 'api_error' },
      { status: 502 }
    );
  }
}
