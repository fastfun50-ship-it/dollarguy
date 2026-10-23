import Link from 'next/link';

export default function BacktestPage() {
  return (
    <main className="min-h-screen bg-[#0a1018] text-[#e8eef7] p-8">
      <div className="max-w-xl mx-auto space-y-4">
        <Link href="/" className="text-sm text-[#8b9bb3] hover:text-white">
          ← Scanner
        </Link>
        <h1 className="text-2xl font-semibold">Backtest</h1>
        <div className="rounded-lg border border-[#1e2a3d] bg-[#0f1724] p-6 space-y-2">
          <p className="text-amber-400 font-semibold">Kommer i M2</p>
          <p className="text-sm text-[#8b9bb3]">
            Backtest med P&amp;L er ikke del af M1. Ingen simulerede resultater her.
          </p>
        </div>
      </div>
    </main>
  );
}
