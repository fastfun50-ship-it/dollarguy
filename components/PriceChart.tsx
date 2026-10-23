'use client';

/**
 * PriceChart — TradingView lightweight-charts (Apache-2.0).
 * Display only; OHLC/VWAP/OR come from our documented data chain (EXAMPLE until keys).
 * Attribution: see footer + README NOTICE.
 */

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, DataMode } from '@/lib/types';

export type ChartInterval = '1m' | '5m' | '15m' | '1t' | 'D';

export interface PriceChartProps {
  symbol: string;
  bars: Bar[];
  vwap: number | null;
  orHigh: number | null;
  orLow: number | null;
  interval: ChartInterval;
  onIntervalChange?: (i: ChartInterval) => void;
  mode: DataMode;
  last?: number;
  className?: string;
}

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1t', 'D'];
const UP = '#22c55e';
const DOWN = '#ef4444';
const VWAP_COLOR = '#3b82f6';
const OR_COLOR = '#a78bfa';
const GRID = '#1e2a3d';
const MUTED = '#8b9bb3';
const BG = '#0a1018';

function aggregateBars(bars: Bar[], interval: ChartInterval): Bar[] {
  if (interval === '1m' || bars.length === 0) return bars;
  if (interval === 'D') {
    const first = bars[0];
    const last = bars[bars.length - 1];
    let h = first.h;
    let l = first.l;
    let v = 0;
    for (const b of bars) {
      h = Math.max(h, b.h);
      l = Math.min(l, b.l);
      v += b.v;
    }
    return [{ t: first.t, o: first.o, h, l, c: last.c, v }];
  }
  const minutes = interval === '5m' ? 5 : interval === '15m' ? 15 : 60;
  const out: Bar[] = [];
  let bucket: Bar | null = null;
  let bucketStart = -1;
  for (const b of bars) {
    const m = Math.floor(new Date(b.t).getTime() / 60_000);
    const start = Math.floor(m / minutes) * minutes;
    if (!bucket || start !== bucketStart) {
      if (bucket) out.push(bucket);
      bucket = { ...b };
      bucketStart = start;
    } else {
      bucket.h = Math.max(bucket.h, b.h);
      bucket.l = Math.min(bucket.l, b.l);
      bucket.c = b.c;
      bucket.v += b.v;
      bucket.t = b.t;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

function toUtcTs(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

export default function PriceChart({
  symbol,
  bars,
  vwap,
  orHigh,
  orLow,
  interval,
  onIntervalChange,
  mode,
  last,
  className = '',
}: PriceChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([]);
  const isExample = mode === 'EXAMPLE';
  const series = aggregateBars(bars, interval);
  const displayLast = last ?? (series.length ? series[series.length - 1].c : undefined);
  const lastVol = series.length ? series[series.length - 1].v : 0;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: MUTED,
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: 'rgba(30,42,61,0.35)' },
        horzLines: { color: GRID },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: GRID,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height: el.clientHeight || 240,
    });

    const candles = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: true,
      wickVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: wrapRef.current.clientWidth,
        height: wrapRef.current.clientHeight || 240,
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candles = candleRef.current;
    const volume = volRef.current;
    const chart = chartRef.current;
    if (!candles || !volume || !chart) return;

    const series = aggregateBars(bars, interval);
    const displayLast = last ?? (series.length ? series[series.length - 1].c : undefined);

    if (!series.length) {
      candles.setData([]);
      volume.setData([]);
      return;
    }

    candles.setData(
      series.map((b) => ({
        time: toUtcTs(b.t),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      }))
    );

    volume.setData(
      series.map((b) => ({
        time: toUtcTs(b.t),
        value: b.v,
        color: b.c >= b.o ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)',
      }))
    );

    for (const pl of priceLinesRef.current) {
      try { candles.removePriceLine(pl); } catch { /* already gone */ }
    }
    priceLinesRef.current = [];

    const addLine = (opts: Parameters<ISeriesApi<'Candlestick'>['createPriceLine']>[0]) => {
      priceLinesRef.current.push(candles.createPriceLine(opts));
    };

    if (vwap != null) {
      addLine({
        price: vwap,
        color: VWAP_COLOR,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `VWAP ${vwap.toFixed(2)}`,
      });
    }
    if (orHigh != null) {
      addLine({
        price: orHigh,
        color: OR_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `OR high ${orHigh.toFixed(2)}`,
      });
    }
    if (orLow != null) {
      addLine({
        price: orLow,
        color: OR_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `OR low ${orLow.toFixed(2)}`,
      });
    }
    if (displayLast != null) {
      candles.applyOptions({
        lastValueVisible: true,
        priceLineColor: UP,
        priceLineVisible: true,
        priceLineWidth: 1,
      });
    }

    chart.timeScale().fitContent();
  }, [bars, interval, vwap, orHigh, orLow, last]);

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center gap-2 px-1 pb-1.5 flex-wrap">
        <span className="text-sm font-extrabold tracking-wide">{symbol}</span>
        <div className="flex gap-0.5 rounded-md border border-[#1e2a3d] overflow-hidden" role="tablist">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              role="tab"
              aria-selected={interval === iv}
              onClick={() => onIntervalChange?.(iv)}
              className={`px-2 py-0.5 text-[10px] font-bold ${
                interval === iv
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0a1018] text-[#8b9bb3] hover:text-white'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
        {isExample && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-pink-400 bg-pink-500/20 text-pink-300">
            EXAMPLE
          </span>
        )}
        <span className="ml-auto text-[10px] text-[#8b9bb3] tabular-nums">
          Volumen {lastVol >= 1e6 ? `${(lastVol / 1e6).toFixed(1)}M` : `${(lastVol / 1e3).toFixed(1)}K`} · ET
        </span>
      </div>
      <div
        ref={wrapRef}
        className="w-full h-[200px] md:h-[250px] rounded-md border border-[#1e2a3d] overflow-hidden"
        data-chart-engine="lightweight-charts"
      />
      <div className="flex gap-3 text-[10px] text-[#8b9bb3] px-1 pt-1 flex-wrap">
        {vwap != null && (
          <span>
            <i className="inline-block w-3.5 h-0.5 bg-blue-500 align-middle mr-1" />
            VWAP {vwap.toFixed(2)}
          </span>
        )}
        {orHigh != null && orLow != null && (
          <span>
            <i
              className="inline-block w-3.5 border-t border-dashed align-middle mr-1"
              style={{ borderColor: OR_COLOR }}
            />
            OR high {orHigh.toFixed(2)} · OR low {orLow.toFixed(2)}
          </span>
        )}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-slate-500 hover:text-[#8b9bb3] underline-offset-2 hover:underline"
        >
          Charting by TradingView
        </a>
      </div>
    </div>
  );
}
