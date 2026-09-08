-- WebPoint Tax Certificate Processor
-- Operational store for TCS / TPA / RDS + RAG knowledge.
-- Search Spul county URLs remain file-backed (data/counties.json + golden_overrides.json)
-- and are mirrored here for SQL reporting and Workplace import.

CREATE TABLE IF NOT EXISTS jurisdictions (
  key TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  entity TEXT,
  entity_type TEXT,
  entity_note TEXT,
  vendor TEXT,
  search_url TEXT,
  rds_url TEXT,
  gis_url TEXT,
  treasurer_url TEXT,
  reject_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified BOOLEAN NOT NULL DEFAULT false,
  source TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jurisdictions_state_county_idx
  ON jurisdictions (state, county);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  jurisdiction_key TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv_idx ON knowledge_chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS knowledge_chunks_jur_idx ON knowledge_chunks (jurisdiction_key);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  file_number TEXT,
  client_name TEXT,
  county TEXT,
  state TEXT,
  closing_date DATE,
  status TEXT NOT NULL DEFAULT 'queued',
  source TEXT NOT NULL DEFAULT 'embed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS order_parcels (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  parcel_id TEXT,
  owner_name TEXT,
  address_line TEXT,
  city TEXT,
  zip TEXT,
  legal_description TEXT,
  amounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  collector_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS order_parcels_order_idx ON order_parcels (order_id);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  parcel_row_id TEXT,
  parcel_id TEXT,
  as_of DATE NOT NULL,
  tax_status TEXT NOT NULL DEFAULT 'unknown',
  current_due NUMERIC,
  delinquent_due NUMERIC,
  collector_url TEXT,
  narrative TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certificates_order_idx ON certificates (order_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_session_idx ON conversations (session_id, created_at);

CREATE TABLE IF NOT EXISTS workplace_imports (
  id TEXT PRIMARY KEY,
  path TEXT,
  kind TEXT,
  files_seen INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
