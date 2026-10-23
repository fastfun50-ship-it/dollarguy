/**
 * Backtest is M2 — not functional P&L in M1.
 */
export async function runBacktest(_options: unknown) {
  return {
    status: 'M2_PENDING' as const,
    message: 'Backtest kommer i milepæl 2. Ingen P&L i M1.',
    pnl: null,
    trades: [],
    winRate: null,
  };
}
