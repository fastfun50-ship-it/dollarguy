import Link from 'next/link';

export default function WatchlistPage() {
  return (
    <main className="min-h-screen bg-[#0a1018] text-[#e8eef7] p-8">
      <div className="max-w-xl mx-auto space-y-4">
        <Link href="/" className="text-sm text-[#8b9bb3] hover:text-white">
          ← Scanner
        </Link>
        <h1 className="text-2xl font-semibold">Watchlist</h1>
        <p className="text-sm text-[#8b9bb3]">
          Watchlist gemmes lokalt i en senere iteration. Ingen paper-ordrer i M1.
        </p>
      </div>
    </main>
  );
}
