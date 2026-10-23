import { NextRequest, NextResponse } from 'next/server';
import { getTickerDetail } from '@/lib/scanner';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: { sym: string } }
) {
  const sym = decodeURIComponent(ctx.params.sym).toUpperCase();
  const detail = await getTickerDetail(sym);
  if (!detail) {
    return NextResponse.json(
      { error: 'Ticker ikke fundet', symbol: sym },
      { status: 404 }
    );
  }
  return NextResponse.json(detail);
}
