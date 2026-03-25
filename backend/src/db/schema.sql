-- ============================================================
-- AI Secure Data Intelligence Platform — PostgreSQL Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Analysis Sessions Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_type     VARCHAR(20) NOT NULL CHECK (input_type IN ('text', 'file', 'log', 'sql', 'chat')),
  content_length INTEGER,
  risk_score     NUMERIC(4,1),
  risk_level     VARCHAR(10) CHECK (risk_level IN ('clean', 'low', 'medium', 'high', 'critical')),
  action         VARCHAR(10) CHECK (action IN ('allowed', 'masked', 'blocked')),
  ai_summary     TEXT,
  processing_ms  INTEGER,
  uploaded_filename TEXT,
  uploaded_size INTEGER,
  uploaded_mime TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration-safety: add new columns if table already existed
ALTER TABLE analysis_sessions ADD COLUMN IF NOT EXISTS uploaded_filename TEXT;
ALTER TABLE analysis_sessions ADD COLUMN IF NOT EXISTS uploaded_size INTEGER;
ALTER TABLE analysis_sessions ADD COLUMN IF NOT EXISTS uploaded_mime TEXT;

-- Migration-safety: update risk_level constraint to include 'clean'
ALTER TABLE analysis_sessions DROP CONSTRAINT IF EXISTS analysis_sessions_risk_level_check;
ALTER TABLE analysis_sessions ADD CONSTRAINT analysis_sessions_risk_level_check
  CHECK (risk_level IN ('clean', 'low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_sessions_user ON analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_risk  ON analysis_sessions(risk_level);
CREATE INDEX IF NOT EXISTS idx_sessions_date  ON analysis_sessions(created_at);

-- ─── Findings Table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS findings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  finding_type  VARCHAR(50) NOT NULL,
  risk_level    VARCHAR(10) NOT NULL,
  risk_score    NUMERIC(4,1),
  line_number   INTEGER,
  description   TEXT,
  masked_value  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_session ON findings(session_id);
CREATE INDEX IF NOT EXISTS idx_findings_type    ON findings(finding_type);
CREATE INDEX IF NOT EXISTS idx_findings_risk    ON findings(risk_level);

-- ─── Activity Log Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  metadata   JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_date   ON activity_log(created_at);

-- ─── Alerts (Risk Reports) Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE SET NULL,
  type       VARCHAR(60) NOT NULL,
  severity   VARCHAR(10) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message    TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

-- ─── Chat Messages Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at);

-- ─── Password Reset Tokens ───────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);

-- ─── API Usage Tracking ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  endpoint      VARCHAR(255) NOT NULL,
  method        VARCHAR(10)  NOT NULL,
  status_code   INTEGER,
  response_ms   INTEGER,
  request_size  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at);

-- ─── Triggers: auto-update updated_at ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Seed: Default Admin User ─────────────────────────────────
-- Password: Admin1234! (bcrypt hash for testing only — CHANGE IN PRODUCTION)
INSERT INTO users (id, email, password_hash, role)
VALUES (
  uuid_generate_v4(),
  'admin@aisecure.dev',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedbN5bZuYXR2.RFO',
  'admin'
) ON CONFLICT (email) DO NOTHING;
