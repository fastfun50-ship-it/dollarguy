// Backtest runner
// Tests selected signals over a date range in the fixed window

import { getDataProvider } from './dataProvider';
import { evaluateSignals } from './signals';

export async function runBacktest(options: {
  startDate: string;
  endDate: string;
  enabledSignals: string[];
  capital?: number;
}) {
  const provider = getDataProvider();
  // TODO: loop days, fetch bars in 09:35-10:35, evaluate signals, simulate trades
  return {
    pnl: 0,
    trades: [],
    winRate: 0,
  };
}
