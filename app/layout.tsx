import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DollarGuy — Scanner',
  description: 'US stock momentum scanner (paper research — no auto-trading)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
