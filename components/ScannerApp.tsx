'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import Link from 'next/link';
import type { AlertEvent, Candidate, FilterDefaults, ScanStatus, TickerDetail } from '@/lib/types';
import { DEFAULT_FILTERS } from '@/lib/types';
import PriceChart, { type ChartInterval } from './PriceChart';

type ScanTab = 'HOD' | 'Gappers' | 'Top Gainers' | 'Running Up' | 'Rel. volumen' | 'Volumen spikes' | 'ORB';

type UiFilters = FilterDefaults & {
  includeOtc: boolean;
  exchange: 'nyse_nasdaq' | 'all';
  chgMinPct: number;
  rvolDayMin: number;
  spikeRvol5: number;
  enableHod: boolean;
  enableRun: boolean;
  enableOrb: boolean;
};

const INITIAL_FILTERS: UiFilters = {
  ...DEFAULT_FILTERS,
  includeOtc: false,
  exchange: 'nyse_nasdaq',
  chgMinPct: 0,
  rvolDayMin: 0,
  spikeRvol5: 5,
  enableHod: true,
  enableRun: true,
  enableOrb: true,
};

function fmtPct(n: number): string {
  const s = (n * 100).toFixed(1);
  return n >= 0 ? `+${s}` : s;
}

function fmtVol(n: number | null | undefined): string {
  if (n == null) return 'ukendt';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function fmtRvol(n: number | null | undefined): string {
  if (n == null) return 'ukendt';
  return n.toFixed(1);
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [tab, setTab] = useState<ScanTab>('HOD');
  const [freeze, setFreeze] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<UiFilters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<UiFilters>(INITIAL_FILTERS);
  const [chartInterval, setChartInterval] = useState<ChartInterval>('1m');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/scan', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data.status);
      setCandidates((prev) => {
        if (freeze && prev.length > 0) return prev;
        return data.candidates ?? [];
      });
      const incoming: AlertEvent[] = data.alerts ?? [];
      setAlerts([...incoming].sort((a, b) => b.tsEt.localeCompare(a.tsEt)));
      const feed = data.status?.feed;
      setError(
        data.status?.message && (feed === 'DOWN' || feed === 'NOT_CONFIGURED')
          ? data.status.message
          : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente scan');
    } finally {
      setLoading(false);
    }
  }, [freeze]);

  useEffect(() => {
    load();
    const tickMs =
      status?.feed === 'RATE_LIMITED' || status?.feed === 'STALE' ? 30_000 : 20_000;
    const id = setInterval(() => {
      if (!freeze) load();
    }, tickMs);
    return () => clearInterval(id);
  }, [load, freeze, status?.feed]);

  // Auto-select first visible candidate once
  useEffect(() => {
    if (selected || candidates.length === 0) return;
    const prefer = candidates.find((c) => c.symbol === 'EXMP') ?? candidates[0];
    setSelected(prefer.symbol);
  }, [candidates, selected]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    (async () => {
      try {
        const res = await fetch(`/api/ticker/${encodeURIComponent(selected)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setDetail(null);
            const kind = data?.kind === 'api_error' ? 'API-fejl' : 'Ikke fundet';
            setDetailError(
              `${kind}: ${data?.error || `Kunne ikke hente ${selected} (${res.status})`}`
            );
          }
          return;
        }
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof Error ? e.message : 'Detail-fejl');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const f = appliedFilters;
    return candidates.filter((c) => {
      if (c.last < f.priceMin || c.last > f.priceMax) return false;
      if (c.float != null && c.float > f.floatMax) return false;
      if (c.gapPct < f.gapMinPct) return false;
      if (c.chgClosePct < f.chgMinPct) return false;
      if (c.rvolDay != null && c.rvolDay < f.rvolDayMin) return false;

      if (tab === 'HOD') return f.enableHod && c.signal === 'HOD';
      if (tab === 'ORB') return f.enableOrb && c.signal === 'ORB5';
      if (tab === 'Running Up') return f.enableRun && c.signal === 'RUN';
      if (tab === 'Volumen spikes')
        return c.signal === 'VS' || (c.rvol5m != null && c.rvol5m >= f.spikeRvol5);
      if (tab === 'Rel. volumen') return c.rvol5m != null && c.rvol5m >= f.rvol5Min;
      if (tab === 'Top Gainers') return c.chgClosePct >= 0.05;
      if (tab === 'Gappers') return c.gapPct >= f.gapMinPct;
      return true;
    });
  }, [candidates, tab, appliedFilters]);

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => b.tsEt.localeCompare(a.tsEt)),
    [alerts]
  );

  const counts = useMemo(() => {
    const f = appliedFilters;
    const all = candidates.filter(
      (c) =>
        c.last >= f.priceMin &&
        c.last <= f.priceMax &&
        (c.float == null || c.float <= f.floatMax) &&
        c.gapPct >= f.gapMinPct
    );
    return {
      HOD: all.filter((c) => c.signal === 'HOD').length,
      Gappers: all.filter((c) => c.gapPct >= f.gapMinPct).length,
      'Top Gainers': all.filter((c) => c.chgClosePct >= 0.05).length,
      'Running Up': all.filter((c) => c.signal === 'RUN').length,
      'Rel. volumen': all.filter((c) => c.rvol5m != null && c.rvol5m >= f.rvol5Min).length,
      'Volumen spikes': all.filter(
        (c) => c.signal === 'VS' || (c.rvol5m != null && c.rvol5m >= f.spikeRvol5)
      ).length,
      ORB: all.filter((c) => c.signal === 'ORB5').length,
    } as Record<ScanTab, number>;
  }, [candidates, appliedFilters]);

  // Do not default to EXAMPLE while loading — that falsely badges LIVE deploys.
  const mode = status?.mode;
  const isExample = mode === 'EXAMPLE';

  function selectTicker(sym: string) {
    setSelected(sym);
    setMobileDetailOpen(true);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setFiltersOpen(false);
  }

  function resetFilters() {
    setDraftFilters(INITIAL_FILTERS);
  }

  const detailPanel = (
    <DetailPanel
      detail={detail}
      loading={detailLoading}
      error={detailError}
      selected={selected}
      isExample={isExample}
      mode={mode ?? 'EXAMPLE'}
      chartInterval={chartInterval}
      onIntervalChange={setChartInterval}
      onCloseMobile={() => setMobileDetailOpen(false)}
    />
  );

  return (
    <div className="flex flex-col h-[100dvh] min-h-0 bg-[#0a1018] text-[#e8eef7]">
      {filtersOpen && (
        <FilterDrawer
          draft={draftFilters}
          setDraft={setDraftFilters}
          onClose={() => setFiltersOpen(false)}
          onReset={resetFilters}
          onApply={applyFilters}
        />
      )}

      {/* Top */}
      <header className="flex items-center gap-3 md:gap-4 px-3 md:px-3.5 py-2 bg-[#0f1724] border-b border-[#1e2a3d] flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 font-bold text-[15px]">
          <div className="w-[22px] h-[22px] rounded-[5px] bg-gradient-to-br from-blue-500 to-blue-700 grid place-items-center text-[12px] font-extrabold text-white">
            D
          </div>
          DollarGuy
        </div>
        <nav className="hidden sm:flex gap-0.5">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-md text-white bg-blue-500/20 shadow-[inset_0_-2px_0_#3b82f6] font-medium"
          >
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
          {mode === 'LIVE' && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide ${
                status?.feed === 'RATE_LIMITED' || status?.feed === 'STALE'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {status?.feed === 'RATE_LIMITED'
                ? 'LIVE · RATE_LIMITED'
                : status?.feed === 'STALE'
                  ? 'LIVE · STALE'
                  : 'LIVE'}
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
          <span
            className="text-[11px] text-[#8b9bb3] tabular-nums"
            title={
              isExample
                ? 'EXAMPLE session clock matches chart 09:30–09:42 ET (not wall clock)'
                : 'Seneste feed-update (ET)'
            }
          >
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

      {(status?.feed === 'RATE_LIMITED' || status?.feed === 'STALE') && (
        <div className="px-3 py-2 text-sm bg-amber-500/15 border-b border-amber-500/40 text-amber-100">
          {status.message || 'Datahentning begrænset'}
          {status.feed === 'RATE_LIMITED' ? ' · feed=RATE_LIMITED' : ' · feed=STALE'}
        </div>
      )}

      {isExample && (
        <div className="px-3 py-1.5 text-[11px] bg-pink-500/10 border-b border-pink-400/40 text-pink-200">
          Alle kurser, tickere og hændelser er fiktive (EXMP/DEMO/…). Ikke live markedsdata — vendor-keys
          mangler.
        </div>
      )}

      {mode === 'LIVE' && (
        <div className="px-3 py-1.5 text-[11px] bg-sky-500/10 border-b border-sky-400/40 text-sky-200">
          LIVE Alpaca Basic — discovery via SIP screener (most-actives/movers); bars/snapshots ={' '}
          <strong>IEX</strong> (~ikke fuld markedsvolumen). Float findes ikke i feed. Ingen ordreafgivelse.
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#131c2c] border-b border-[#1e2a3d] flex-shrink-0 flex-wrap">
        <Chip
          label="Pris"
          value={`$${appliedFilters.priceMin}–${appliedFilters.priceMax}`}
        />
        <Chip label="Gap%" value={`≥ ${(appliedFilters.gapMinPct * 100).toFixed(0)}%`} />
        <Chip label="Rel.vol" value={`≥ ${appliedFilters.rvol5Min}× (rvol_5m)`} />
        <Chip label="Float" value={`≤ ${(appliedFilters.floatMax / 1e6).toFixed(0)}M`} />
        <button
          type="button"
          onClick={() => {
            setDraftFilters(appliedFilters);
            setFiltersOpen(true);
          }}
          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 border border-blue-500 text-white"
          aria-expanded={filtersOpen}
        >
          Alle filtre
        </button>
        <div className="w-px h-5 bg-[#1e2a3d]" />
        <label className="inline-flex items-center gap-1.5 text-xs bg-[#0a1018] border border-[#1e2a3d] rounded-md px-2.5 py-1">
          <span className="text-[#8b9bb3]">Preset</span>
          <select
            className="bg-transparent outline-none"
            defaultValue="rth"
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'pm') {
                setAppliedFilters((f) => ({ ...f, gapMinPct: 0.04 }));
                setTab('Gappers');
              } else if (v === 'orb') {
                setTab('ORB');
              } else {
                setTab('HOD');
              }
            }}
          >
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
                {t}{' '}
                <span className="text-[10px] font-medium text-[#8b9bb3] ml-1">{counts[t]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f1724] border-b border-[#1e2a3d] text-[11px] text-[#8b9bb3] flex-shrink-0">
            <strong className="text-[#e8eef7]">Kandidater</strong> · {filtered.length} match · sort:{' '}
            <strong className="text-blue-400">Gap% ▼</strong> · refresh {status?.feed === 'RATE_LIMITED' || status?.feed === 'STALE' ? '30s' : '20s'} · freeze {freeze ? 'on' : 'off'}
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            {loading ? (
              <p className="p-4 text-[#8b9bb3]">Henter…</p>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-[#8b9bb3] space-y-1">
                {status?.feed === 'RATE_LIMITED' || status?.feed === 'STALE' ? (
                  <>
                    <p className="text-amber-200 font-medium">Datahentning begrænset</p>
                    <p>
                      {status.message ||
                        'Alpaca rate limit / forældet cache. Listen er tom midlertidigt — ikke «ingen match».'}
                    </p>
                  </>
                ) : candidates.length === 0 && status?.feed !== 'OK' ? (
                  <>
                    <p className="text-amber-200 font-medium">Datahentning begrænset</p>
                    <p>{status?.message || 'Ingen kandidater fra feed lige nu.'}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[#e8eef7] font-medium">Ingen tickers matcher filtre</p>
                    <p>Prøv at sænke Gap% eller skift scan-tab. Tomt resultat ≠ datafejl.</p>
                  </>
                )}
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
                      onClick={() => selectTicker(c.symbol)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectTicker(c.symbol);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected === c.symbol}
                      className={`cursor-pointer border-b border-[#1e2a3d]/70 hover:bg-blue-500/5 ${
                        selected === c.symbol
                          ? 'bg-blue-500/20 outline outline-1 outline-blue-500/35 -outline-offset-1'
                          : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 text-left">{i + 1}</td>
                      <td className="px-2 py-1.5 text-left font-bold tracking-wide">{c.symbol}</td>
                      <td className="px-2 py-1.5 text-right">{c.last.toFixed(2)}</td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          c.chgClosePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {fmtPct(c.chgClosePct)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          c.gapPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {fmtPct(c.gapPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmtRvol(c.rvolDay)}</td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          c.rvol5m != null && c.rvol5m >= 2 ? 'text-emerald-400' : ''
                        }`}
                      >
                        {fmtRvol(c.rvol5m)}
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmtVol(c.volume)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtVol(c.float)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {c.signal && (
                          <span
                            className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${signalClass(
                              c.signal
                            )}`}
                          >
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
              {sortedAlerts.length === 0 ? (
                <p className="px-3 py-2 text-slate-500">Ingen alerts endnu</p>
              ) : (
                sortedAlerts.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => selectTicker(a.symbol)}
                    className="grid grid-cols-[62px_48px_1fr_56px] gap-2 px-3 py-1 border-b border-[#1e2a3d]/55 hover:bg-white/[0.02] cursor-pointer"
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

        {/* Desktop detail */}
        <aside className="hidden lg:flex flex-col min-h-0 bg-[#0f1724] overflow-auto">
          {detailPanel}
        </aside>
      </div>

      {/* Mobile detail sheet */}
      {mobileDetailOpen && selected && (
        <div className="lg:hidden fixed inset-0 z-30 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Luk detaljer"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div className="relative z-10 max-h-[85dvh] overflow-auto rounded-t-xl border border-[#1e2a3d] bg-[#0f1724] shadow-2xl">
            {detailPanel}
          </div>
        </div>
      )}

      <footer className="flex-shrink-0 px-3.5 py-1.5 border-t border-[#1e2a3d] bg-[#0f1724] flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
        <span>
          {isExample
            ? 'Alle kurser, tickere og hændelser er fiktive.'
            : 'Live/delayed feed — se statusbadge.'}
        </span>
        <span className="flex items-center gap-2 flex-wrap justify-end">
          <span>DollarGuy · M1 · ingen auto-handel</span>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#8b9bb3] underline-offset-2 hover:underline"
          >
            Charts by TradingView
          </a>
          <span className="text-slate-600">(lightweight-charts · Apache-2.0)</span>
        </span>
      </footer>
    </div>
  );
}

function DetailPanel({
  detail,
  loading,
  error,
  selected,
  isExample,
  mode,
  chartInterval,
  onIntervalChange,
  onCloseMobile,
}: {
  detail: TickerDetail | null;
  loading: boolean;
  error: string | null;
  selected: string | null;
  isExample: boolean;
  mode: ScanStatus['mode'];
  chartInterval: ChartInterval;
  onIntervalChange: (i: ChartInterval) => void;
  onCloseMobile: () => void;
}) {
  if (!selected) {
    return <p className="p-4 text-[#8b9bb3]">Vælg en ticker</p>;
  }
  if (loading && !detail) {
    return <p className="p-4 text-[#8b9bb3]">Henter {selected}…</p>;
  }
  if (error && !detail) {
    return (
      <div className="p-4 text-sm text-red-300 space-y-2">
        <p>{error}</p>
        <button
          type="button"
          className="lg:hidden text-xs underline text-[#8b9bb3]"
          onClick={onCloseMobile}
        >
          Luk
        </button>
      </div>
    );
  }
  if (!detail) {
    return <p className="p-4 text-[#8b9bb3]">Vælg en ticker</p>;
  }

  return (
    <>
      <div className="p-3 border-b border-[#1e2a3d] flex-shrink-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-xl font-extrabold tracking-wide">{detail.candidate.symbol}</span>
          <span className="text-xs text-[#8b9bb3]">
            {detail.candidate.name}
            {isExample ? ' · EXAMPLE' : ''}
          </span>
          <button
            type="button"
            className="lg:hidden ml-auto text-[#8b9bb3] text-lg leading-none px-2"
            onClick={onCloseMobile}
            aria-label="Luk"
          >
            ×
          </button>
        </div>
        <div className="mt-1">
          <span className="text-[28px] font-bold tabular-nums">
            ${detail.candidate.last.toFixed(2)}
          </span>
          <span
            className={`text-sm font-semibold ml-2 ${
              detail.candidate.chgClosePct >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {fmtPct(detail.candidate.chgClosePct)}% (
            {detail.candidate.chgAbs >= 0 ? '+' : ''}
            {detail.candidate.chgAbs.toFixed(2)})
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2.5">
          <Stat k="Gap%" v={fmtPct(detail.candidate.gapPct)} pos={detail.candidate.gapPct >= 0} />
          <Stat k="RVolD" v={detail.candidate.rvolDay == null ? 'ukendt' : `${fmtRvol(detail.candidate.rvolDay)}×`} />
          <Stat
            k="RVol5"
            v={detail.candidate.rvol5m == null ? 'ukendt' : `${fmtRvol(detail.candidate.rvol5m)}×`}
            pos={detail.candidate.rvol5m != null && detail.candidate.rvol5m >= 2}
          />
          <Stat k="Float" v={fmtVol(detail.candidate.float)} />
        </div>
      </div>

      <div className="flex-[0_0_auto] p-2 border-b border-[#1e2a3d]">
        {detail.barsMeta?.error && detail.bars.length === 0 ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-4 text-xs text-red-200 space-y-1">
            <p className="font-bold">API-fejl — kunne ikke hente IEX-minutbarer</p>
            <p className="text-red-200/80">{detail.barsMeta.error}</p>
            <p className="text-[10px] text-slate-400">{detail.barsMeta.source}</p>
          </div>
        ) : detail.bars.length === 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-4 text-xs text-amber-100 space-y-1">
            <p className="font-bold">Ingen IEX-minutbarer</p>
            <p className="text-amber-100/80">
              {detail.barsMeta?.emptyReason ??
                'Gyldigt svar fra Alpaca, men tom bar-serie — grafen er ikke EXAMPLE-fallback.'}
            </p>
            <p className="text-[10px] text-slate-400">
              {detail.barsMeta?.source} · count={detail.barsMeta?.count ?? 0}
            </p>
          </div>
        ) : (
          <PriceChart
            symbol={detail.candidate.symbol}
            bars={detail.bars}
            vwap={detail.vwap}
            orHigh={detail.orHigh}
            orLow={detail.orLow}
            interval={chartInterval}
            onIntervalChange={onIntervalChange}
            mode={mode}
            last={detail.candidate.last}
            dayVolume={detail.candidate.volume}
          />
        )}
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
          [...detail.alerts]
            .sort((a, b) => b.tsEt.localeCompare(a.tsEt))
            .map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[54px_1fr_50px] gap-2 text-[11px] py-1 tabular-nums text-slate-300"
              >
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
        <button
          type="button"
          className="flex-1 justify-center px-2 py-2 rounded-md text-xs font-semibold border border-[#1e2a3d] bg-[#0a1018]"
        >
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
  );
}

function FilterDrawer({
  draft,
  setDraft,
  onClose,
  onReset,
  onApply,
}: {
  draft: UiFilters;
  setDraft: Dispatch<SetStateAction<UiFilters>>;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/55 z-40"
        aria-label="Luk filtre"
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 w-full max-w-[400px] h-[100dvh] bg-[#0f1724] border-l border-[#1e2a3d] z-50 flex flex-col shadow-[-12px_0_40px_rgba(0,0,0,.45)]"
        aria-label="Alle filtre"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1e2a3d]">
          <h2 className="text-[15px] font-bold">Alle filtre</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-[#1e2a3d] bg-[#0a1018] text-[#8b9bb3] grid place-items-center text-base"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          <FilterGroup title="1. Univers / pris" hint="universe">
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="Pris min"
                unit="$"
                value={draft.priceMin}
                onChange={(v) => setDraft((d) => ({ ...d, priceMin: v }))}
              />
              <NumField
                label="Pris max"
                unit="$"
                value={draft.priceMax}
                onChange={(v) => setDraft((d) => ({ ...d, priceMax: v }))}
              />
              <NumField
                label="Float max"
                unit="M"
                value={draft.floatMax / 1e6}
                onChange={(v) => setDraft((d) => ({ ...d, floatMax: v * 1e6 }))}
              />
              <div>
                <div className="text-[11px] text-[#8b9bb3] mb-0.5">Exchange</div>
                <div className="flex items-center gap-1.5 bg-[#0f1724] border border-[#1e2a3d] rounded px-2 py-1 text-[11px]">
                  <select
                    className="bg-transparent w-full outline-none"
                    value={draft.exchange}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        exchange: e.target.value as UiFilters['exchange'],
                      }))
                    }
                  >
                    <option value="nyse_nasdaq">NYSE+NASDAQ</option>
                    <option value="all">Alle listed</option>
                  </select>
                </div>
              </div>
            </div>
            <CheckRow
              checked={draft.includeOtc}
              label="Inkludér OTC"
              onChange={(v) => setDraft((d) => ({ ...d, includeOtc: v }))}
            />
          </FilterGroup>

          <FilterGroup title="2. Gap & change" hint="gap_pm / gap_open / chg_close">
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="Gap% min"
                unit="%"
                value={draft.gapMinPct * 100}
                onChange={(v) => setDraft((d) => ({ ...d, gapMinPct: v / 100 }))}
              />
              <NumField
                label="Chg% vs close min"
                unit="%"
                value={draft.chgMinPct * 100}
                onChange={(v) => setDraft((d) => ({ ...d, chgMinPct: v / 100 }))}
              />
            </div>
          </FilterGroup>

          <FilterGroup title="3. Volumen" hint="rvol_day · rvol_5m · spikes">
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="RVolD min"
                unit="×"
                value={draft.rvolDayMin}
                onChange={(v) => setDraft((d) => ({ ...d, rvolDayMin: v }))}
              />
              <NumField
                label="RVol5 min"
                unit="×"
                value={draft.rvol5Min}
                onChange={(v) => setDraft((d) => ({ ...d, rvol5Min: v }))}
              />
              <NumField
                label="Spike RVol5"
                unit="×"
                value={draft.spikeRvol5}
                onChange={(v) => setDraft((d) => ({ ...d, spikeRvol5: v }))}
              />
            </div>
          </FilterGroup>

          <FilterGroup title="4. Session-signaler" hint="HOD · Running Up · ORB_N">
            <CheckRow
              checked={draft.enableHod}
              label={`HOD (cooldown ${draft.hodCooldownMin} min)`}
              onChange={(v) => setDraft((d) => ({ ...d, enableHod: v }))}
            />
            <CheckRow
              checked={draft.enableRun}
              label={`Running Up (K=${draft.runK}m, X=${(draft.runX * 100).toFixed(0)}%)`}
              onChange={(v) => setDraft((d) => ({ ...d, enableRun: v }))}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <CheckRow
                checked={draft.enableOrb}
                label="ORB_N — N="
                onChange={(v) => setDraft((d) => ({ ...d, enableOrb: v }))}
              />
              <div className="flex items-center gap-1 bg-[#0f1724] border border-[#1e2a3d] rounded px-2 py-1 text-[11px] w-[70px]">
                <input
                  type="number"
                  className="bg-transparent w-full outline-none tabular-nums"
                  value={draft.orbN}
                  min={1}
                  max={30}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, orbN: Number(e.target.value) || 5 }))
                  }
                />
                <span className="text-slate-500">min</span>
              </div>
            </div>
          </FilterGroup>

          <FilterGroup title="5. Avanceret" hint="v1.1 · ikke primær scan">
            <p className="text-[11px] text-slate-500">
              VWAP reclaim-alert kommer i v1.1. VWAP vises som graf-overlay.
            </p>
          </FilterGroup>
        </div>
        <div className="p-3 border-t border-[#1e2a3d] flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 px-2 py-2 rounded-md text-xs font-semibold border border-[#1e2a3d] bg-[#0a1018]"
          >
            Nulstil
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 px-2 py-2 rounded-md text-xs font-semibold border border-blue-500 bg-blue-600 text-white"
          >
            Anvend filtre
          </button>
        </div>
      </aside>
    </>
  );
}

function FilterGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-[#1e2a3d] rounded-md bg-[#0a1018] overflow-hidden">
      <div className="px-2.5 py-1.5 bg-[#131c2c] text-[10px] font-bold uppercase tracking-wider text-blue-300 flex justify-between">
        {title}
        <span className="font-medium normal-case tracking-normal text-slate-500">{hint}</span>
      </div>
      <div className="px-2.5 py-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[11px] text-[#8b9bb3] mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5 bg-[#0f1724] border border-[#1e2a3d] rounded px-2 py-1 text-[11px] tabular-nums">
        <input
          type="number"
          step="any"
          className="bg-transparent w-full outline-none"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs text-slate-300 text-left"
    >
      <span
        className={`w-3.5 h-3.5 rounded-[3px] border grid place-items-center text-[10px] ${
          checked
            ? 'border-blue-500 bg-blue-500/25 text-blue-300'
            : 'border-[#1e2a3d] bg-transparent text-transparent'
        }`}
      >
        ✓
      </span>
      {label}
    </button>
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
      <div className={`text-[13px] font-bold tabular-nums mt-0.5 ${pos ? 'text-emerald-400' : ''}`}>
        {v}
      </div>
    </div>
  );
}
