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
  risk_level     VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  action         VARCHAR(10) CHECK (action IN ('allowed', 'masked', 'blocked')),
  ai_summary     TEXT,
  processing_ms  INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
