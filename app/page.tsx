'use client';

import { useState } from 'react';
import { signalList } from '@/lib/signals';

export default function Home() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    rel_volume: true,
    orb: true,
    gap_confirm: true,
  });

  const toggle = (name: string) => {
    setEnabled(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const activeCount = Object.values(enabled).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">D</div>
            <h1 className="text-2xl font-semibold tracking-tight">DollarGuy</h1>
          </div>
          <div className="text-sm text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Paper · IBKR
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-1">
            <div className="px-4 py-2.5 rounded-lg text-sm bg-zinc-800 text-white">Signals</div>
            <div className="px-4 py-2.5 rounded-lg text-sm text-zinc-400">Backtests</div>
            <div className="px-4 py-2.5 rounded-lg text-sm text-zinc-400">Results</div>
          </aside>

          <section className="lg:col-span-3 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium">Signals</h2>
                  <p className="text-sm text-zinc-400">{activeCount} active</p>
                </div>
                <button className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition">
                  Run Backtest
                </button>
              </div>

              <div className="divide-y divide-zinc-800">
                {signalList.map(s => (
                  <div key={s.name} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-zinc-500">{s.category}</div>
                    </div>
                    <button
                      onClick={() => toggle(s.name)}
                      className={`w-10 h-6 rounded-full flex items-center px-0.5 transition ${enabled[s.name] ? 'bg-emerald-600 justify-end' : 'bg-zinc-700'}`}
                    >
                      <div className="w-5 h-5 bg-white rounded-full shadow" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-medium mb-4">Latest Result</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">P&L</div>
                  <div className="text-2xl font-semibold text-emerald-400">+$420</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Win Rate</div>
                  <div className="text-2xl font-semibold">58%</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Trades</div>
                  <div className="text-2xl font-semibold">47</div>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mt-4">09:35–10:35 ET · Last 90 days</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
