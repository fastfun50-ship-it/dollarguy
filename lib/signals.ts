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
  rel_volume: (bars) => {
    // placeholder
    return { name: 'rel_volume', hit: false };
  },
  orb: (bars) => {
    return { name: 'orb', hit: false };
  },
  gap_confirm: (bars) => {
    return { name: 'gap_confirm', hit: false };
  },
  // Add more signals here
};

export function evaluateSignals(bars: any[], enabled: string[]): SignalResult[] {
  return enabled
    .map(name => signals[name]?.(bars))
    .filter(Boolean) as SignalResult[];
}
