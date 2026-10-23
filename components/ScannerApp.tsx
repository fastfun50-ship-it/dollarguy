'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AlertEvent, Candidate, ScanStatus, TickerDetail } from '@/lib/types';

type ScanTab = 'HOD' | 'Gappers' | 'Top Gainers' | 'Running Up' | 'Rel. volumen' | 'Volumen spikes' | 'ORB';

function fmtPct(n: number): string {
  const s = (n * 100).toFixed(1);
  return n >= 0 ? `+${s}` : s;
}

function fmtVol(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function signalClass(s: string | null): string {
  if (s === 'HOD') return 'bg-emerald-500/15 text-emerald-300';
  if (s === 'ORB5') return 'bg-purple-500/15 text-purple-300';
  if (s === 'VS') return 'bg-amber-500/15 text-amber-300';
  if (s === 'RUN') return 'bg-sky-500/15 text-sky-300';
  return 'bg-blue-500/15 text-blue-300';
}

export default function ScannerApp() {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [tab, setTab] = useState<ScanTab>('HOD');
  const [freeze, setFreeze] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scan', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data.status);
      if (!freeze || candidates.length === 0) {
        setCandidates(data.candidates ?? []);
      }
      setAlerts(data.alerts ?? []);
      setError(data.status?.message && data.status.feed === 'DOWN' ? data.status.message : null);
      if (!selected && data.candidates?.length) {
        setSelected(data.candidates[0].symbol);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente scan');
    } finally {
      setLoading(false);
    }
  }, [freeze, candidates.length, selected]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!freeze) load();
    }, 8000);
    return () => clearInterval(id);
  }, [load, freeze]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ticker/${selected}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDetail(data);
      } catch {
        /* detail best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (tab === 'HOD') return c.signal === 'HOD';
      if (tab === 'ORB') return c.signal === 'ORB5';
      if (tab === 'Running Up') return c.signal === 'RUN';
      if (tab === 'Volumen spikes') return c.signal === 'VS';
      if (tab === 'Rel. volumen') return c.rvol5m >= 2;
      if (tab === 'Top Gainers') return c.chgClosePct >= 0.05;
      if (tab === 'Gappers') return c.gapPct >= 0.04;
      return true;
    });
  }, [candidates, tab]);

  const counts = useMemo(() => {
    const all = candidates;
    return {
      HOD: all.filter((c) => c.signal === 'HOD').length,
      Gappers: all.filter((c) => c.gapPct >= 0.04).length,
      'Top Gainers': all.filter((c) => c.chgClosePct >= 0.05).length,
      'Running Up': all.filter((c) => c.signal === 'RUN').length,
      'Rel. volumen': all.filter((c) => c.rvol5m >= 2).length,
      'Volumen spikes': all.filter((c) => c.signal === 'VS').length,
      ORB: all.filter((c) => c.signal === 'ORB5').length,
    } as Record<ScanTab, number>;
  }, [candidates]);

  const mode = status?.mode ?? 'EXAMPLE';
  const isExample = mode === 'EXAMPLE';

  return (
    <div className="flex flex-col h-[100dvh] min-h-0 bg-[#0a1018] text-[#e8eef7]">
      {/* Top */}
      <header className="flex items-center gap-3 md:gap-4 px-3 md:px-3.5 py-2 bg-[#0f1724] border-b border-[#1e2a3d] flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 font-bold text-[15px]">
          <div className="w-[22px] h-[22px] rounded-[5px] bg-gradient-to-br from-blue-500 to-blue-700 grid place-items-center text-[12px] font-extrabold text-white">
            D
          </div>
          DollarGuy
        </div>
        <nav className="hidden sm:flex gap-0.5">
          <Link href="/" className="px-3 py-1.5 rounded-md text-white bg-blue-500/20 shadow-[inset_0_-2px_0_#3b82f6] font-medium">
            Scanner
          </Link>
          <Link href="/watchlist" className="px-3 py-1.5 rounded-md text-[#8b9bb3] font-medium">
            Watchlist
          </Link>
          <Link href="/backtest" className="px-3 py-1.5 rounded-md text-[#8b9bb3] font-medium">
            Backtest
          </Link>
          <Link href="/results" className="px-3 py-1.5 rounded-md text-[#8b9bb3] font-medium">
            Resultater
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {isExample && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-pink-400 bg-pink-500/20 text-pink-300 tracking-wide">
              EXAMPLE DATA
            </span>
          )}
          {mode === 'DELAYED' && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-amber-500/50 bg-amber-500/15 text-amber-300">
              DELAYED 15m
            </span>
          )}
          <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-amber-500/45 bg-amber-500/10 text-amber-300">
            {(status?.feedLabel ?? '…').toUpperCase()}
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
            {status?.session ?? '…'}
          </span>
          <span className="text-[11px] text-[#8b9bb3] tabular-nums">
            last {status?.lastUpdateEt ?? '—'} ET
          </span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
              status?.ws === 'DOWN'
                ? 'border-red-400/50 bg-red-500/15 text-red-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            ws={status?.ws ?? '…'}
          </span>
        </div>
      </header>

      {!status?.dbConfigured && (
        <div className="px-3 py-1.5 text-[11px] bg-amber-500/10 border-b border-amber-500/30 text-amber-200">
          DB not configured — alarmhistorik kun i hukommelse (schema klar i schema.sql).
        </div>
      )}

      {(error || status?.feed === 'DOWN' || status?.feed === 'NOT_CONFIGURED') && (
        <div className="px-3 py-2 text-sm bg-red-500/15 border-b border-red-500/40 text-red-200">
          {error || status?.message || 'Datafejl'}
        </div>
      )}

      {isExample && (
        <div className="px-3 py-1.5 text-[11px] bg-pink-500/10 border-b border-pink-400/40 text-pink-200">
          Alle kurser, tickere og hændelser er fiktive (EXMP/DEMO/…). Ikke live markedsdata — vendor-keys mangler.
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#131c2c] border-b border-[#1e2a3d] flex-shrink-0 flex-wrap">
        <Chip label="Pris" value="$1–20" />
        <Chip label="Gap%" value="≥ 4%" />
        <Chip label="Rel.vol" value="≥ 2× (rvol_5m)" />
        <Chip label="Float" value="≤ 20M" />
        <button type="button" className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 border border-blue-500 text-white">
          Alle filtre
        </button>
        <div className="w-px h-5 bg-[#1e2a3d]" />
        <label className="inline-flex items-center gap-1.5 text-xs bg-[#0a1018] border border-[#1e2a3d] rounded-md px-2.5 py-1">
          <span className="text-[#8b9bb3]">Preset</span>
          <select className="bg-transparent outline-none" defaultValue="rth">
            <option value="pm">Premarket gappers</option>
            <option value="rth">RTH momentum</option>
            <option value="orb">ORB only</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setFreeze((f) => !f)}
          className="px-2.5 py-1 rounded-md text-xs font-semibold border border-[#1e2a3d] bg-[#0a1018] inline-flex items-center gap-1.5"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${freeze ? 'bg-emerald-500' : 'bg-slate-500'}`} />
          {freeze ? 'Freeze list' : 'Live list'}
        </button>
        <button
          type="button"
          onClick={() => load()}
          className="px-2.5 py-1 rounded-md text-xs font-semibold border border-[#1e2a3d] bg-transparent text-[#e8eef7]"
        >
          Genindlæs
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] min-h-0">
        <section className="flex flex-col min-h-0 border-r border-[#1e2a3d]">
          <div className="flex gap-0.5 px-2.5 pt-2 bg-[#0f1724] border-b border-[#1e2a3d] overflow-x-auto flex-shrink-0">
            {(Object.keys(counts) as ScanTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 ${
                  tab === t ? 'text-white border-blue-500' : 'text-[#8b9bb3] border-transparent'
                }`}
              >
                {t} <span className="text-[10px] font-medium text-[#8b9bb3] ml-1">{counts[t]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f1724] border-b border-[#1e2a3d] text-[11px] text-[#8b9bb3] flex-shrink-0">
            <strong className="text-[#e8eef7]">Kandidater</strong> · {filtered.length} match · sort:{' '}
            <strong className="text-blue-400">Gap% ▼</strong> · refresh 8s · freeze {freeze ? 'on' : 'off'}
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            {loading ? (
              <p className="p-4 text-[#8b9bb3]">Henter…</p>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-[#8b9bb3] space-y-1">
                <p className="text-[#e8eef7] font-medium">Ingen tickers matcher filtre</p>
                <p>Prøv at sænke Gap% eller skift scan-tab. Tomt resultat ≠ datafejl.</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="sticky top-0 bg-[#152033] text-[#8b9bb3] font-semibold">
                    {['#', 'Sym', 'Last', 'Chg%', 'Gap% ▼', 'RVolD', 'RVol5', 'Vol', 'Float', 'Signal', 'Age'].map(
                      (h) => (
                        <th
                          key={h}
                          className={`px-2 py-1.5 border-b border-[#1e2a3d] whitespace-nowrap ${
                            h === '#' || h === 'Sym' ? 'text-left' : 'text-right'
                          } ${h.startsWith('Gap') ? 'text-blue-400' : ''}`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr
                      key={c.symbol}
                      onClick={() => setSelected(c.symbol)}
                      className={`cursor-pointer border-b border-[#1e2a3d]/70 hover:bg-blue-500/5 ${
                        selected === c.symbol ? 'bg-blue-500/20 outline outline-1 outline-blue-500/35 -outline-offset-1' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 text-left">{i + 1}</td>
                      <td className="px-2 py-1.5 text-left font-bold tracking-wide">{c.symbol}</td>
                      <td className="px-2 py-1.5 text-right">{c.last.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right ${c.chgClosePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtPct(c.chgClosePct)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${c.gapPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtPct(c.gapPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right">{c.rvolDay.toFixed(1)}</td>
                      <td className={`px-2 py-1.5 text-right ${c.rvol5m >= 2 ? 'text-emerald-400' : ''}`}>
                        {c.rvol5m.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmtVol(c.volume)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtVol(c.float)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {c.signal && (
                          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${signalClass(c.signal)}`}>
                            {c.signal}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">{c.ageMin}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex-[0_0_180px] md:flex-[0_0_210px] flex flex-col border-t border-[#1e2a3d] bg-[#0f1724] min-h-0">
            <h3 className="text-[11px] uppercase tracking-wider text-[#8b9bb3] px-3 pt-2 pb-1 font-bold flex gap-2">
              Alarmhistorik
              <span className="font-medium normal-case tracking-normal text-slate-500">
                append-only · nyeste øverst · ET
              </span>
            </h3>
            <div className="flex-1 overflow-auto text-[11px] tabular-nums">
              {alerts.length === 0 ? (
                <p className="px-3 py-2 text-slate-500">Ingen alerts endnu</p>
              ) : (
                alerts.map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-[62px_48px_1fr_56px] gap-2 px-3 py-1 border-b border-[#1e2a3d]/55 hover:bg-white/[0.02]"
                  >
                    <span className="text-[#8b9bb3]">{a.tsEt}</span>
                    <span className="font-bold">{a.symbol}</span>
                    <span className="text-slate-300 truncate">{a.message}</span>
                    <span className="text-emerald-400 text-right">{a.price.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Detail */}
        <aside className="hidden lg:flex flex-col min-h-0 bg-[#0f1724]">
          {detail ? (
            <>
              <div className="p-3 border-b border-[#1e2a3d] flex-shrink-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xl font-extrabold tracking-wide">{detail.candidate.symbol}</span>
                  <span className="text-xs text-[#8b9bb3]">
                    {detail.candidate.name}
                    {isExample ? ' · EXAMPLE' : ''}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-[28px] font-bold tabular-nums">${detail.candidate.last.toFixed(2)}</span>
                  <span
                    className={`text-sm font-semibold ml-2 ${
                      detail.candidate.chgClosePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fmtPct(detail.candidate.chgClosePct)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                  <Stat k="Gap%" v={fmtPct(detail.candidate.gapPct)} pos={detail.candidate.gapPct >= 0} />
                  <Stat k="RVolD" v={`${detail.candidate.rvolDay.toFixed(1)}×`} />
                  <Stat k="RVol5" v={`${detail.candidate.rvol5m.toFixed(1)}×`} pos={detail.candidate.rvol5m >= 2} />
                  <Stat k="Float" v={fmtVol(detail.candidate.float)} />
                </div>
              </div>

              <div className="flex-[0_0_200px] p-2 border-b border-[#1e2a3d] relative">
                <div className="absolute top-2 right-4 flex gap-2.5 text-[10px] text-[#8b9bb3]">
                  {detail.vwap != null && (
                    <span>
                      <i className="inline-block w-3.5 h-0.5 bg-blue-500 align-middle mr-1" />
                      VWAP {detail.vwap.toFixed(2)}
                    </span>
                  )}
                  {detail.orHigh != null && detail.orLow != null && (
                    <span>
                      OR {detail.orLow.toFixed(2)}–{detail.orHigh.toFixed(2)}
                    </span>
                  )}
                  <span>1m</span>
                </div>
                <MiniChart bars={detail.bars} orHigh={detail.orHigh} orLow={detail.orLow} />
              </div>

              <div className="p-2.5 border-b border-[#1e2a3d]">
                <h4 className="text-[11px] uppercase tracking-wider text-[#8b9bb3] mb-2">Hvorfor fundet?</h4>
                <ol className="list-decimal pl-4 text-xs text-slate-300 space-y-1">
                  {detail.candidate.why.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ol>
              </div>

              <div className="p-2.5 border-b border-[#1e2a3d]">
                <h4 className="text-[11px] uppercase tracking-wider text-[#8b9bb3] mb-2">
                  Seneste alerts · {detail.candidate.symbol}
                </h4>
                {detail.alerts.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Ingen</p>
                ) : (
                  detail.alerts.map((a) => (
                    <div key={a.id} className="grid grid-cols-[54px_1fr_50px] gap-2 text-[11px] py-1 tabular-nums text-slate-300">
                      <span>{a.tsEt}</span>
                      <span>{a.message}</span>
                      <span className="text-emerald-400 text-right">{a.price.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 border-b border-[#1e2a3d]">
                <h4 className="text-[11px] uppercase tracking-wider text-[#8b9bb3] mb-2">Nyheder</h4>
                {detail.news.map((n, i) => (
                  <div key={i} className="text-xs text-slate-300 py-1.5 border-b border-[#1e2a3d]/50">
                    <span className="text-[#8b9bb3] text-[11px] mr-2 tabular-nums">{n.when}</span>
                    {n.headline}
                  </div>
                ))}
              </div>

              <div className="p-2.5 flex gap-2 mt-auto">
                <button type="button" className="flex-1 justify-center px-2 py-2 rounded-md text-xs font-semibold border border-[#1e2a3d] bg-[#0a1018]">
                  + Watchlist
                </button>
                <button
                  type="button"
                  disabled
                  title="Paper-ordrer er ikke del af M1"
                  className="flex-1 justify-center px-2 py-2 rounded-md text-xs font-semibold border border-[#1e2a3d] bg-transparent text-slate-500 cursor-not-allowed"
                >
                  Paper sim — M2
                </button>
              </div>
            </>
          ) : (
            <p className="p-4 text-[#8b9bb3]">Vælg en ticker</p>
          )}
        </aside>
      </div>

      <footer className="flex-shrink-0 px-3.5 py-1.5 border-t border-[#1e2a3d] bg-[#0f1724] flex justify-between text-[11px] text-slate-500">
        <span>
          {isExample
            ? 'Alle kurser, tickere og hændelser er fiktive.'
            : 'Live/delayed feed — se statusbadge.'}
        </span>
        <span>DollarGuy · US Stock Momentum Scanner · M1 · ingen auto-handel</span>
      </footer>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-[#0a1018] border border-[#1e2a3d] rounded-md px-2.5 py-1 text-xs">
      <span className="text-[#8b9bb3] text-[11px]">{label}</span>
      <strong className="font-semibold tabular-nums">{value}</strong>
    </div>
  );
}

function Stat({ k, v, pos }: { k: string; v: string; pos?: boolean }) {
  return (
    <div className="bg-[#0a1018] border border-[#1e2a3d] rounded-md px-2 py-1.5">
      <div className="text-[10px] text-[#8b9bb3] uppercase tracking-wide">{k}</div>
      <div className={`text-[13px] font-bold tabular-nums mt-0.5 ${pos ? 'text-emerald-400' : ''}`}>{v}</div>
    </div>
  );
}

function MiniChart({
  bars,
  orHigh,
  orLow,
}: {
  bars: { o: number; h: number; l: number; c: number; v: number }[];
  orHigh: number | null;
  orLow: number | null;
}) {
  const slice = bars.slice(-30);
  if (!slice.length) return <div className="h-[160px] text-[#8b9bb3] text-xs p-4">Ingen grafdata</div>;
  const lows = slice.map((b) => b.l);
  const highs = slice.map((b) => b.h);
  const min = Math.min(...lows, orLow ?? Infinity);
  const max = Math.max(...highs, orHigh ?? -Infinity);
  const span = max - min || 1;
  const W = 520;
  const H = 160;
  const y = (p: number) => H - 20 - ((p - min) / span) * (H - 40);
  const bw = W / slice.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" preserveAspectRatio="none" aria-hidden>
      <line x1={0} y1={40} x2={W} y2={40} stroke="#1e2a3d" />
      <line x1={0} y1={80} x2={W} y2={80} stroke="#1e2a3d" />
      <line x1={0} y1={120} x2={W} y2={120} stroke="#1e2a3d" />
      {orHigh != null && (
        <line x1={0} y1={y(orHigh)} x2={W} y2={y(orHigh)} stroke="#a78bfa" strokeDasharray="4 3" />
      )}
      {orLow != null && (
        <line x1={0} y1={y(orLow)} x2={W} y2={y(orLow)} stroke="#a78bfa" strokeDasharray="4 3" />
      )}
      {slice.map((b, i) => {
        const x = i * bw + bw / 2;
        const up = b.c >= b.o;
        const color = up ? '#22c55e' : '#f87171';
        return (
          <g key={i}>
            <line x1={x} y1={y(b.h)} x2={x} y2={y(b.l)} stroke={color} />
            <rect
              x={x - 3}
              y={y(Math.max(b.o, b.c))}
              width={6}
              height={Math.max(1, Math.abs(y(b.o) - y(b.c)))}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}
