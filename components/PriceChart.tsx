'use client';

/**
 * PriceChart — TradingView lightweight-charts (Apache-2.0).
 * Alma P0 (CHART-P0-EPOW-BOLT): sparse-aware spacing, VWAP line series, expand.
 * Display only; OHLC from documented data chain — never invent bars.
 */

import { useEffect, useRef, useState } from 'react';
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
  computeVwapSeries,
  visibleLogicalRangeForBars,
  formatEtShort,
  type ChartInterval,
} from '@/lib/chartTime';

export type { ChartInterval };

export interface PriceChartProps {
  symbol: string;
  bars: Bar[];
  /** Legacy scalar — used only as legend fallback when series empty (EXAMPLE). Not drawn as price line. */
  vwap: number | null;
  orHigh: number | null;
  orLow: number | null;
  interval: ChartInterval;
  onIntervalChange?: (i: ChartInterval) => void;
  mode: DataMode;
  last?: number;
  dayVolume?: number | null;
  /** Parent-driven clear: when true, series wiped + loading overlay. */
  loading?: boolean;
  className?: string;
  /** Controlled expand from detail panel (optional). */
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1t', 'D'];
const UP = '#22c55e';
const DOWN = '#ef4444';
const VWAP_COLOR = '#3b82f6';
const OR_COLOR = '#a78bfa';
const GRID = '#1e2a3d';
const MUTED = '#8b9bb3';
const BG = '#0a1018';
/** Logical slots so 3–12 IEX bars stay narrow (Alma §2). */
const SPARSE_MIN_SLOTS = 48;

function applyVisibleRange(chart: IChartApi, barCount: number) {
  const ts = chart.timeScale();
  const range = visibleLogicalRangeForBars(barCount, SPARSE_MIN_SLOTS);
  // Dense: fit then pad. Sparse: fixed spacing + wide logical window (empty right).
  if (barCount >= SPARSE_MIN_SLOTS) {
    ts.applyOptions({ barSpacing: 6, minBarSpacing: 3, rightOffset: 4 });
    ts.fitContent();
    ts.setVisibleLogicalRange(range);
  } else {
    ts.applyOptions({ barSpacing: 7, minBarSpacing: 5, rightOffset: 6 });
    ts.setVisibleLogicalRange(range);
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
  loading = false,
  className = '',
  expanded: expandedProp,
  onExpandedChange,
}: PriceChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const vwapRef = useRef<ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([]);
  const barCountRef = useRef(0);
  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = expandedProp ?? expandedLocal;
  const setExpanded = (v: boolean) => {
    onExpandedChange?.(v);
    if (expandedProp === undefined) setExpandedLocal(v);
  };

  const isExample = mode === 'EXAMPLE';
  const series = aggregateBars(bars, interval);
  const displayLast = last ?? (series.length ? series[series.length - 1].c : undefined);
  const lastVol = series.length ? series[series.length - 1].v : 0;
  const seriesVolSum = series.reduce((s, b) => s + b.v, 0);
  const volLabel = (() => {
    const pick = lastVol > 0 ? lastVol : seriesVolSum > 0 ? seriesVolSum : dayVolume ?? 0;
    const tag = lastVol > 0 ? 'sidste bar' : seriesVolSum > 0 ? 'bars sum' : dayVolume ? 'dag' : '—';
    const txt =
      pick >= 1e6 ? `${(pick / 1e6).toFixed(1)}M` : pick >= 1e3 ? `${(pick / 1e3).toFixed(1)}K` : String(pick);
    return `Volumen ${txt} (${tag}) · ET`;
  })();

  const coverageLabel = (() => {
    if (!series.length) return '0 bars';
    const first = series[0].t;
    const lastT = series[series.length - 1].t;
    const n = series.length;
    const thin = n < 24 ? 'Tynd IEX-dækning · ' : '';
    return `${thin}${n} bars · ${formatEtShort(first)}–${formatEtShort(lastT)} ET`;
  })();

  const vwapPoints = computeVwapSeries(series);
  const vwapLast =
    vwapPoints.length > 0 ? vwapPoints[vwapPoints.length - 1].value : vwap;

  // Escape closes expand
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

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
        rightOffset: 4,
        barSpacing: 7,
        minBarSpacing: 4,
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
      height: el.clientHeight || 360,
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

    const vwapSeries = chart.addLineSeries({
      color: VWAP_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      title: 'VWAP',
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = volume;
    vwapRef.current = vwapSeries;

    const syncSizeAndFit = () => {
      if (!wrapRef.current || !chartRef.current) return;
      const w = wrapRef.current.clientWidth;
      const h = wrapRef.current.clientHeight || 360;
      if (w <= 0) return;
      chartRef.current.applyOptions({ width: w, height: h });
      applyVisibleRange(chartRef.current, barCountRef.current);
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(syncSizeAndFit);
      });
    });
    ro.observe(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(syncSizeAndFit);
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
      vwapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candles = candleRef.current;
    const volume = volRef.current;
    const vwapSeries = vwapRef.current;
    const chart = chartRef.current;
    if (!candles || !volume || !vwapSeries || !chart) return;

    // Immediate clear on loading / empty — no stale previous ticker series.
    if (loading || !bars.length) {
      candles.setData([]);
      volume.setData([]);
      vwapSeries.setData([]);
      for (const pl of priceLinesRef.current) {
        try {
          candles.removePriceLine(pl);
        } catch {
          /* gone */
        }
      }
      priceLinesRef.current = [];
      barCountRef.current = 0;
      return;
    }

    const { candles: candleData, volumes: volData } = prepareChartSeries(bars, interval);
    barCountRef.current = candleData.length;

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

    const vwapData = computeVwapSeries(aggregateBars(bars, interval));
    vwapSeries.setData(
      vwapData.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
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

    const addOrLine = (opts: Parameters<ISeriesApi<'Candlestick'>['createPriceLine']>[0]) => {
      priceLinesRef.current.push(candles.createPriceLine(opts));
    };

    // OR H/L = horizontal session levels (Alma §4 — price line OK for OR only).
    if (orHigh != null) {
      addOrLine({
        price: orHigh,
        color: OR_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `OR high ${orHigh.toFixed(2)}`,
      });
    }
    if (orLow != null) {
      addOrLine({
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

    const applyFit = () => {
      if (!chartRef.current || !wrapRef.current) return;
      const w = wrapRef.current.clientWidth;
      if (w > 0) {
        chartRef.current.applyOptions({
          width: w,
          height: wrapRef.current.clientHeight || 360,
        });
      }
      applyVisibleRange(chartRef.current, barCountRef.current);
    };
    applyFit();
    requestAnimationFrame(() => {
      requestAnimationFrame(applyFit);
    });
  }, [bars, interval, orHigh, orLow, last, displayLast, loading, symbol]);

  // Re-fit when expand toggles (height jump)
  useEffect(() => {
    const chart = chartRef.current;
    const el = wrapRef.current;
    if (!chart || !el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chart.applyOptions({
          width: el.clientWidth,
          height: el.clientHeight || 360,
        });
        applyVisibleRange(chart, barCountRef.current);
      });
    });
  }, [expanded]);

  const chartHeightClass = expanded
    ? 'h-[min(70vh,640px)]'
    : 'h-[320px] md:h-[360px] lg:h-[380px]';

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
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-semibold px-2 py-0.5 rounded border border-[#1e2a3d] text-[#8b9bb3] hover:text-white hover:border-blue-500/50"
        >
          {expanded ? 'Luk udvidelse' : 'Udvid graf'}
        </button>
        <span className="ml-auto text-[10px] text-[#8b9bb3] tabular-nums">{volLabel}</span>
      </div>
      <p className="px-1 pb-1 text-[10px] text-[#8b9bb3] tabular-nums" data-testid="bars-coverage">
        {coverageLabel}
      </p>
      <div className={`relative w-full ${chartHeightClass} rounded-md border border-[#1e2a3d] overflow-hidden`}>
        <div
          ref={wrapRef}
          className="absolute inset-0"
          data-chart-engine="lightweight-charts"
        />
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a1018]/75">
            <p className="text-xs text-[#8b9bb3] animate-pulse">Henter {symbol}…</p>
          </div>
        )}
        {!loading && bars.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a1018]/90 px-4">
            <p className="text-xs text-amber-100 text-center">Ingen bars for {symbol}</p>
          </div>
        )}
      </div>
      <div className="flex gap-3 text-[10px] text-[#8b9bb3] px-1 pt-1 flex-wrap">
        {vwapLast != null && (
          <span>
            <i className="inline-block w-3.5 h-0.5 bg-blue-500 align-middle mr-1" />
            VWAP {vwapLast.toFixed(2)}
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
