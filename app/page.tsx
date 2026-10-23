export default function Home() {
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
            <NavItem active>Scanner</NavItem>
            <NavItem>Signals</NavItem>
            <NavItem>Backtests</NavItem>
            <NavItem>Results</NavItem>
          </aside>

          <section className="lg:col-span-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium">Active Signals</h2>
                  <p className="text-sm text-zinc-400">Toggle what the system tests</p>
                </div>
                <button className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg">
                  Run Backtest
                </button>
              </div>

              <div className="space-y-3">
                <SignalRow name="Relative Volume" category="Volume" enabled />
                <SignalRow name="Opening Range Breakout" category="Breakout" enabled />
                <SignalRow name="Gap + Confirmation" category="Gap" enabled />
                <SignalRow name="EMA 9/20" category="Moving Average" />
                <SignalRow name="Higher Highs / Lows" category="Structure" />
              </div>
            </div>

            <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-medium mb-4">Latest Backtest</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <Stat label="P&L" value="+$420" positive />
                <Stat label="Win Rate" value="58%" />
                <Stat label="Trades" value="47" />
              </div>
              <p className="text-sm text-zinc-400 mt-4">Tested 2026-07-01 → 2026-10-01 · 09:35–10:35 ET</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function NavItem({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div className={`px-4 py-2.5 rounded-lg text-sm cursor-pointer ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'}`}>
      {children}
    </div>
  );
}

function SignalRow({ name, category, enabled }: { name: string; category: string; enabled?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-zinc-500">{category}</div>
      </div>
      <div className={`w-10 h-6 rounded-full flex items-center px-0.5 cursor-pointer ${enabled ? 'bg-emerald-600 justify-end' : 'bg-zinc-700'}`}>
        <div className="w-5 h-5 bg-white rounded-full shadow" />
      </div>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${positive ? 'text-emerald-400' : ''}`}>{value}</div>
    </div>
  );
}
