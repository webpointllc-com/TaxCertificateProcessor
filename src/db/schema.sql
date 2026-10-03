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
  account_id TEXT,
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

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  company TEXT,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  activity_on BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recents_account_idx ON recents (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_messages_idx ON account_messages (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_id TEXT;
CREATE INDEX IF NOT EXISTS orders_account_idx ON orders (account_id, created_at DESC);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS learn_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS search_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS member_code_id TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS training_retention TEXT NOT NULL DEFAULT 'until_delete';

CREATE TABLE IF NOT EXISTS email_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  account_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otps_email_idx ON email_otps (email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS member_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  code_hint TEXT NOT NULL,
  label TEXT,
  seats INTEGER NOT NULL DEFAULT 25,
  redeemed INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guest_usage (
  session_id TEXT PRIMARY KEY,
  search_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extractors (
  id TEXT PRIMARY KEY,
  jurisdiction_key TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT NOT NULL,
  entity TEXT,
  search_url TEXT,
  method JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'seed',
  validated BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extractors_key_idx ON extractors (jurisdiction_key, status, version DESC);

ALTER TABLE extractors ADD COLUMN IF NOT EXISTS parcel_format TEXT;
ALTER TABLE extractors ADD COLUMN IF NOT EXISTS exceptions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE extractors ADD COLUMN IF NOT EXISTS layout JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS search_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  jurisdiction_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_sessions_account_idx ON search_sessions (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS extractor_versions (
  id TEXT PRIMARY KEY,
  extractor_id TEXT,
  jurisdiction_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  search_url TEXT,
  method JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  notes TEXT,
  account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_feedback (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  jurisdiction_key TEXT,
  extractor_id TEXT,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_feedback_key_idx ON session_feedback (jurisdiction_key, created_at DESC);

CREATE TABLE IF NOT EXISTS validation_runs (
  id TEXT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  probed INTEGER NOT NULL DEFAULT 0,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  look_for_hits JSONB NOT NULL DEFAULT '{}'::jsonb,
  method TEXT,
  how JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT
);

ALTER TABLE validation_runs ADD COLUMN IF NOT EXISTS look_for_hits JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE validation_runs ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE validation_runs ADD COLUMN IF NOT EXISTS how JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS extractor_portal_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  session_id TEXT,
  jurisdiction_key TEXT NOT NULL,
  event TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  token_hash TEXT,
  expires_at TIMESTAMPTZ,
  family_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE extractor_portal_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE extractor_portal_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE extractor_portal_sessions ADD COLUMN IF NOT EXISTS family_id TEXT;

-- Own-model training data. Written only for accounts with learn_consent = true.
-- Export re-checks CURRENT consent, so turning learning off stops future use immediately.
CREATE TABLE IF NOT EXISTS training_examples (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  route TEXT NOT NULL,
  jurisdiction_key TEXT,
  messages JSONB NOT NULL,
  reply TEXT NOT NULL,
  model TEXT,
  rating SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_examples_account_idx ON training_examples (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS training_examples_created_idx ON training_examples (created_at);

-- Editor protocol: a human (or Claude, flagging only) reviews every captured answer before it can train.
ALTER TABLE training_examples ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE training_examples ADD COLUMN IF NOT EXISTS corrected_reply TEXT;
ALTER TABLE training_examples ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE training_examples ADD COLUMN IF NOT EXISTS reviewer TEXT;
ALTER TABLE training_examples ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS training_examples_review_idx ON training_examples (review_status, created_at);

-- Extractor lock proposals: Claude or a validator run proposes a collector search URL,
-- a human editor approves it, and the approved lock overrides the file catalog at runtime.
CREATE TABLE IF NOT EXISTS extractor_lock_proposals (
  id TEXT PRIMARY KEY,
  jurisdiction_key TEXT NOT NULL,
  state TEXT,
  county TEXT,
  url TEXT NOT NULL,
  verdict TEXT,
  reason TEXT,
  dr_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposer TEXT,
  proposer_role TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS extractor_lock_proposals_status_idx ON extractor_lock_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS extractor_lock_proposals_key_idx ON extractor_lock_proposals (jurisdiction_key, created_at DESC);
