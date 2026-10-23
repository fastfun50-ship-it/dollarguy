-- DollarGuy M1 schema (Supabase/Neon/Postgres)
-- Apply only when DATABASE_URL is configured. No prod migration from agents without Peter.

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  ts_et TEXT NOT NULL,
  symbol TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alert_events_symbol_idx ON alert_events (symbol);
CREATE INDEX IF NOT EXISTS alert_events_created_idx ON alert_events (created_at DESC);

CREATE TABLE IF NOT EXISTS scan_snapshots (
  id SERIAL PRIMARY KEY,
  mode TEXT NOT NULL,
  session TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy tables kept for forward compat (backtest M2)
CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  enabled BOOLEAN DEFAULT false,
  params JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
