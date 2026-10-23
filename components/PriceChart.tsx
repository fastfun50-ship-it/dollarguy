'use client';

/**
 * PriceChart — TradingView lightweight-charts (Apache-2.0).
 * Display only; OHLC/VWAP/OR come from our documented data chain.
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
import {
  aggregateBars,
  prepareChartSeries,
  type ChartInterval,
} from '@/lib/chartTime';

export type { ChartInterval };

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
  /** Day volume from snapshot (list) — shown when last bar.v is 0. */
  dayVolume?: number | null;
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

/** Fit all candles into view after layout/size is known. */
function fitAllBars(chart: IChartApi, barCount: number) {
  const ts = chart.timeScale();
  ts.fitContent();
  if (barCount > 0) {
    // Logical range: small left/right padding so series isn't glued to the edge.
    ts.setVisibleLogicalRange({
      from: -0.5,
      to: Math.max(barCount - 0.5, 0.5),
    });
  }
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
  dayVolume,
  className = '',
}: PriceChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([]);
  const barCountRef = useRef(0);
  const isExample = mode === 'EXAMPLE';
  const series = aggregateBars(bars, interval);
  const displayLast = last ?? (series.length ? series[series.length - 1].c : undefined);
  const lastVol = series.length ? series[series.length - 1].v : 0;
  const seriesVolSum = series.reduce((s, b) => s + b.v, 0);
  const volLabel = (() => {
    const pick =
      lastVol > 0 ? lastVol : seriesVolSum > 0 ? seriesVolSum : dayVolume ?? 0;
    const tag =
      lastVol > 0 ? 'sidste bar' : seriesVolSum > 0 ? 'bars sum' : dayVolume ? 'dag' : '—';
    const txt =
      pick >= 1e6 ? `${(pick / 1e6).toFixed(1)}M` : pick >= 1e3 ? `${(pick / 1e3).toFixed(1)}K` : String(pick);
    return `Volumen ${txt} (${tag}) · ET`;
  })();

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
        rightOffset: 2,
        barSpacing: 8,
        minBarSpacing: 3,
        lockVisibleTimeRangeOnResize: false,
        tickMarkFormatter: (time: UTCTimestamp) => {
          return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(time * 1000));
        },
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => {
          return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date(time * 1000));
        },
      },
      width: Math.max(el.clientWidth, 1),
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

    const syncSizeAndFit = () => {
      if (!wrapRef.current || !chartRef.current) return;
      const w = wrapRef.current.clientWidth;
      const h = wrapRef.current.clientHeight || 240;
      if (w <= 0) return;
      chartRef.current.applyOptions({ width: w, height: h });
      fitAllBars(chartRef.current, barCountRef.current);
    };

    const ro = new ResizeObserver(() => {
      // After panel open / layout settle — fit again so candles aren't stuck right.
      requestAnimationFrame(() => {
        requestAnimationFrame(syncSizeAndFit);
      });
    });
    ro.observe(el);
    // Initial layout may still be 0×0; schedule one fit after paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(syncSizeAndFit);
    });

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

    const { candles: candleData, volumes: volData } = prepareChartSeries(bars, interval);
    barCountRef.current = candleData.length;

    if (!candleData.length) {
      candles.setData([]);
      volume.setData([]);
      return;
    }

    candles.setData(
      candleData.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volume.setData(
      volData.map((v) => ({
        time: v.time as UTCTimestamp,
        value: v.value,
        color: v.color,
      }))
    );

    for (const pl of priceLinesRef.current) {
      try {
        candles.removePriceLine(pl);
      } catch {
        /* already gone */
      }
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

    // Fit after data + after layout (ticker change / interval / panel resize).
    const applyFit = () => {
      if (!chartRef.current || !wrapRef.current) return;
      const w = wrapRef.current.clientWidth;
      if (w > 0) {
        chartRef.current.applyOptions({
          width: w,
          height: wrapRef.current.clientHeight || 240,
        });
      }
      fitAllBars(chartRef.current, barCountRef.current);
    };
    applyFit();
    requestAnimationFrame(() => {
      requestAnimationFrame(applyFit);
    });
  }, [bars, interval, vwap, orHigh, orLow, last, displayLast]);

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
        <span className="ml-auto text-[10px] text-[#8b9bb3] tabular-nums">{volLabel}</span>
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
