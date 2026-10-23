-- Supabase schema for DollarGuy
-- Trading data only. Separate from system117.

CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT, -- e.g. 'volume', 'breakout', 'ma', 'gap', 'news'
  enabled BOOLEAN DEFAULT false,
  params JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backtest_runs (
  id SERIAL PRIMARY KEY,
  name TEXT,
  start_date DATE,
  end_date DATE,
  window_start TEXT DEFAULT '09:35',
  window_end TEXT DEFAULT '10:35',
  signals_enabled JSONB, -- array of signal names that were on
  capital NUMERIC DEFAULT 10000,
  final_pnl NUMERIC,
  win_rate NUMERIC,
  trades_count INT,
  status TEXT DEFAULT 'pending', -- pending, running, done
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS backtest_trades (
  id SERIAL PRIMARY KEY,
  run_id INT REFERENCES backtest_runs(id),
  symbol TEXT,
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  entry_price NUMERIC,
  exit_price NUMERIC,
  qty NUMERIC,
  pnl NUMERIC,
  signals_hit JSONB
);

CREATE TABLE IF NOT EXISTS rules (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  version INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Seed some core signals
INSERT INTO signals (name, description, category, enabled) VALUES
('rel_volume', 'Relative volume spike vs 20-day avg', 'volume', true),
('orb', 'Opening range breakout (first 15-30 min)', 'breakout', true),
('gap_confirm', 'Gap up with post-open confirmation', 'gap', true),
('ema_cross', 'EMA 9/20 cross or bounce', 'ma', false),
('hh_hl', 'Higher highs + higher lows', 'structure', false),
('vol_confirm', 'Volume confirmation on breakout', 'volume', false)
ON CONFLICT (name) DO NOTHING;
