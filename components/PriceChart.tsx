'use client';

/**
 * PriceChart — M1 interim SVG chart with the target API for lightweight-charts
 * (TradingView, Apache-2.0). Do NOT npm-install lightweight-charts until Mira/Peter
 * approve the dependency (STANDARD §4). Swap implementation behind this props surface.
 *
 * Wire: candles + volume pane + VWAP + OR, interval tabs, EXAMPLE badge.
 */

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
  /** Current last — shown in green box on Y when provided. */
  last?: number;
  className?: string;
}

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1t', 'D'];

function aggregateBars(bars: Bar[], interval: ChartInterval): Bar[] {
  if (interval === '1m' || bars.length === 0) return bars;
  const minutes =
    interval === '5m' ? 5 : interval === '15m' ? 15 : interval === '1t' ? 60 : 9999;
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
  const out: Bar[] = [];
  let bucket: Bar | null = null;
  let bucketStart = -1;
  for (const b of bars) {
    const m = minutesSinceEpoch(b.t);
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

function minutesSinceEpoch(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 60_000);
}

function fmtEt(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
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
  const series = aggregateBars(bars, interval);
  const isExample = mode === 'EXAMPLE';

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center gap-2 px-1 pb-1.5 flex-wrap">
        <span className="text-sm font-extrabold tracking-wide">{symbol}</span>
        <div className="flex gap-0.5 rounded-md border border-[#1e2a3d] overflow-hidden">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
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
          {series.length} bars · {interval}
        </span>
      </div>
      <InterimSvgChart
        bars={series}
        vwap={vwap}
        orHigh={orHigh}
        orLow={orLow}
        last={last ?? (series.length ? series[series.length - 1].c : undefined)}
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
              style={{ borderColor: '#a78bfa' }}
            />
            OR {orLow.toFixed(2)}–{orHigh.toFixed(2)}
          </span>
        )}
        <span className="text-slate-500">ET · interim SVG (lightweight-charts pending approval)</span>
      </div>
    </div>
  );
}

function InterimSvgChart({
  bars,
  vwap,
  orHigh,
  orLow,
  last,
}: {
  bars: Bar[];
  vwap: number | null;
  orHigh: number | null;
  orLow: number | null;
  last?: number;
}) {
  if (!bars.length) {
    return <div className="h-[200px] text-[#8b9bb3] text-xs p-4">Ingen grafdata</div>;
  }

  const W = 560;
  const H = 220;
  const volH = 48;
  const padL = 8;
  const padR = 52;
  const padT = 12;
  const padB = 18;
  const plotH = H - volH - padT - padB;
  const plotW = W - padL - padR;

  const lows = bars.map((b) => b.l);
  const highs = bars.map((b) => b.h);
  const min = Math.min(...lows, orLow ?? Infinity, vwap ?? Infinity);
  const max = Math.max(...highs, orHigh ?? -Infinity, vwap ?? -Infinity);
  const span = max - min || 1;
  const maxV = Math.max(...bars.map((b) => b.v), 1);
  const bw = plotW / bars.length;

  const y = (p: number) => padT + plotH - ((p - min) / span) * plotH;
  const x = (i: number) => padL + i * bw + bw / 2;

  const priceTicks = [min, min + span * 0.25, min + span * 0.5, min + span * 0.75, max];
  const timeIdx = [0, Math.floor(bars.length / 2), bars.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[200px] md:h-[220px]"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Kursgraf"
    >
      {/* grid */}
      {priceTicks.map((p, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={y(p)}
            x2={padL + plotW}
            y2={y(p)}
            stroke="#1e2a3d"
            strokeWidth={1}
          />
          <text x={W - 4} y={y(p) + 3} textAnchor="end" fill="#8b9bb3" fontSize={9}>
            {p.toFixed(2)}
          </text>
        </g>
      ))}

      {/* OR band */}
      {orHigh != null && orLow != null && (
        <>
          <line
            x1={padL}
            y1={y(orHigh)}
            x2={padL + plotW}
            y2={y(orHigh)}
            stroke="#a78bfa"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <line
            x1={padL}
            y1={y(orLow)}
            x2={padL + plotW}
            y2={y(orLow)}
            stroke="#a78bfa"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <text x={padL + 2} y={y(orHigh) - 2} fill="#a78bfa" fontSize={8}>
            OR H {orHigh.toFixed(2)}
          </text>
          <text x={padL + 2} y={y(orLow) + 10} fill="#a78bfa" fontSize={8}>
            OR L {orLow.toFixed(2)}
          </text>
        </>
      )}

      {/* VWAP */}
      {vwap != null && (
        <>
          <line
            x1={padL}
            y1={y(vwap)}
            x2={padL + plotW}
            y2={y(vwap)}
            stroke="#3b82f6"
            strokeWidth={1.5}
          />
          <text x={padL + plotW - 2} y={y(vwap) - 3} textAnchor="end" fill="#3b82f6" fontSize={8}>
            VWAP {vwap.toFixed(2)}
          </text>
        </>
      )}

      {/* candles */}
      {bars.map((b, i) => {
        const cx = x(i);
        const up = b.c >= b.o;
        const color = up ? '#22c55e' : '#ef4444';
        const bodyTop = y(Math.max(b.o, b.c));
        const bodyBot = y(Math.min(b.o, b.c));
        const bodyH = Math.max(1.5, bodyBot - bodyTop);
        const bodyW = Math.max(2, bw * 0.55);
        return (
          <g key={i}>
            <line x1={cx} y1={y(b.h)} x2={cx} y2={y(b.l)} stroke={color} strokeWidth={1} />
            <rect
              x={cx - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              fill={color}
            />
          </g>
        );
      })}

      {/* last badge on Y */}
      {last != null && (
        <g>
          <rect
            x={W - padR + 2}
            y={y(last) - 8}
            width={padR - 6}
            height={14}
            rx={2}
            fill="#22c55e"
          />
          <text
            x={W - 6}
            y={y(last) + 2}
            textAnchor="end"
            fill="#0a1018"
            fontSize={9}
            fontWeight={700}
          >
            {last.toFixed(2)}
          </text>
        </g>
      )}

      {/* volume pane */}
      <line
        x1={padL}
        y1={H - volH}
        x2={padL + plotW}
        y2={H - volH}
        stroke="#1e2a3d"
      />
      {bars.map((b, i) => {
        const cx = x(i);
        const up = b.c >= b.o;
        const color = up ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)';
        const vh = (b.v / maxV) * (volH - 10);
        const bodyW = Math.max(2, bw * 0.55);
        return (
          <rect
            key={`v${i}`}
            x={cx - bodyW / 2}
            y={H - 4 - vh}
            width={bodyW}
            height={Math.max(1, vh)}
            fill={color}
          />
        );
      })}

      {/* time labels */}
      {timeIdx.map((i) => (
        <text
          key={`t${i}`}
          x={x(i)}
          y={H - volH - 4}
          textAnchor="middle"
          fill="#8b9bb3"
          fontSize={8}
        >
          {fmtEt(bars[i].t)}
        </text>
      ))}
    </svg>
  );
}
