/**
 * @deprecated Use lib/data/provider.ts
 * DATA_PROVIDER = market data vendor (example|massive|alpaca), NOT broker.
 * Default is example. IBKR is not an M1 market-data provider.
 */
export { getMarketDataProvider as getDataProvider, providerMeta, resolveDataProviderKind } from './data/provider';
export type { Bar } from './types';
