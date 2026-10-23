// Data provider abstraction
// Switch between IBKR, Alpaca, etc. via env or config

export interface Bar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DataProvider {
  getBars(symbol: string, start: string, end: string, timeframe: string): Promise<Bar[]>;
  getMovers?(minVolume: number, minPct: number): Promise<any[]>;
}

// Placeholder - implement IBKR or Alpaca later
export function getDataProvider(): DataProvider {
  const provider = process.env.DATA_PROVIDER || 'ibkr';
  if (provider === 'ibkr') {
    return new IBKRProvider();
  }
  // fallback
  return new IBKRProvider();
}

class IBKRProvider implements DataProvider {
  async getBars(symbol: string, start: string, end: string, timeframe: string): Promise<Bar[]> {
    // TODO: IBKR Client Portal / TWS API
    throw new Error('IBKR provider not implemented yet');
  }
}
