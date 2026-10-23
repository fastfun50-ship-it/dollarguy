import './globals.css';

export const metadata = {
  title: 'DollarGuy',
  description: 'Paper trading scanner & backtest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
