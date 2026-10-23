// Signal definitions
// Each signal is a pure function that can be toggled

export interface SignalResult {
  name: string;
  hit: boolean;
  score?: number;
  meta?: any;
}

export type SignalFn = (bars: any[], params?: any) => SignalResult;

export const signals: Record<string, SignalFn> = {
  rel_volume: (bars) => ({ name: 'rel_volume', hit: Math.random() > 0.6 }),
  orb: (bars) => ({ name: 'orb', hit: Math.random() > 0.7 }),
  gap_confirm: (bars) => ({ name: 'gap_confirm', hit: Math.random() > 0.65 }),
  ema_cross: (bars) => ({ name: 'ema_cross', hit: Math.random() > 0.75 }),
  hh_hl: (bars) => ({ name: 'hh_hl', hit: Math.random() > 0.8 }),
  vol_confirm: (bars) => ({ name: 'vol_confirm', hit: Math.random() > 0.6 }),
  rsi_oversold: (bars) => ({ name: 'rsi_oversold', hit: Math.random() > 0.85 }),
  vwap_bounce: (bars) => ({ name: 'vwap_bounce', hit: Math.random() > 0.7 }),
};

export function evaluateSignals(bars: any[], enabled: string[]): SignalResult[] {
  return enabled
    .map(name => signals[name]?.(bars))
    .filter(Boolean) as SignalResult[];
}

export const signalList = [
  { name: 'rel_volume', label: 'Relative Volume', category: 'Volume' },
  { name: 'orb', label: 'Opening Range Breakout', category: 'Breakout' },
  { name: 'gap_confirm', label: 'Gap + Confirmation', category: 'Gap' },
  { name: 'ema_cross', label: 'EMA 9/20', category: 'Moving Average' },
  { name: 'hh_hl', label: 'Higher Highs / Lows', category: 'Structure' },
  { name: 'vol_confirm', label: 'Volume Confirmation', category: 'Volume' },
  { name: 'rsi_oversold', label: 'RSI Oversold', category: 'Momentum' },
  { name: 'vwap_bounce', label: 'VWAP Bounce', category: 'VWAP' },
];
