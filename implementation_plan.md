# AI Secure Data Intelligence Platform — Implementation Plan

A production-ready enterprise SaaS platform acting as an AI Gateway, Data Scanner, Log Analyzer, and Risk Engine. The system accepts multi-source inputs, detects sensitive data, scores risk, applies security policies, and generates AI-powered insights.

---

## Proposed Folder Structure

```
Data_secure/
├── backend/                    # Node.js Express API Gateway
│   ├── src/
│   │   ├── routes/
│   │   │   ├── analyze.js
│   │   │   └── auth.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   └── rateLimiter.js
│   │   ├── modules/
│   │   │   ├── detectionEngine.js
│   │   │   ├── logAnalyzer.js
│   │   │   ├── riskEngine.js
│   │   │   ├── policyEngine.js
│   │   │   └── aiService.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── schema.sql
│   │   └── utils/
│   │       └── logger.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── ai-service/                 # Python Flask AI Analysis Service
│   ├── app.py
│   ├── analyzer.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Tailwind SaaS Dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── FileUpload.jsx
│   │   │   ├── TextInput.jsx
│   │   │   ├── LogViewer.jsx
│   │   │   ├── InsightsPanel.jsx
│   │   │   ├── ResultsView.jsx
│   │   │   └── RiskBadge.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── sample-data/
│   ├── sample.log
│   ├── sample_credentials.txt
│   └── test_payload.json
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.ai
└── README.md
```

---

## Proposed Changes

### Backend — Node.js Express

#### [NEW] server.js
Entry point with Helmet, CORS, rate limiting, Winston logging, and route mounting.

#### [NEW] routes/analyze.js
`POST /analyze` — accepts `input_type`, `content`, file uploads (via multer), and `options`. Orchestrates detection, log analysis, risk scoring, policy application, and AI insights. Saves results to PostgreSQL.

#### [NEW] routes/auth.js
`POST /auth/register`, `POST /auth/login` — bcrypt password hashing, JWT signing (15m access token + 7d refresh token), user creation in DB.

#### [NEW] middleware/authMiddleware.js
JWT verification; extracts `user_id` and `role` (admin/user) for RBAC.

#### [NEW] middleware/rateLimiter.js
Express-rate-limit: 100 req/15min globally, 20 req/15min on `/analyze`.

#### [NEW] modules/detectionEngine.js
Regex patterns for: emails, phone numbers, API keys (`sk-`, `AKIA`, generic 40-char hex), passwords (`password=`, `pwd=`, `secret=`), tokens (JWT, Bearer), SSN, credit cards.

#### [NEW] modules/logAnalyzer.js
Line-by-line parser detecting: hardcoded creds, stack traces, HTTP error codes, repeated failed login patterns, SQL injection attempts, suspicious IPs.

#### [NEW] modules/riskEngine.js
Scoring map: `password`/`secret` → 10 (Critical), `api_key` → 8 (High), `token` → 7 (High), `phone` → 5 (Medium), `email` → 3 (Low). Aggregates max/sum for overall score, maps to level.

#### [NEW] modules/policyEngine.js
Based on options + risk level: replace matched strings with `[REDACTED]`, block entire content if critical risk, pass through safe content.

#### [NEW] modules/aiService.js
HTTP POST to Python AI service at `http://localhost:5001/ai/analyze`. Falls back to rule-based summaries if Python service unavailable.

#### [NEW] db/schema.sql
PostgreSQL tables: `users`, `analysis_sessions`, `findings`, `activity_log`.

#### [NEW] db/pool.js
`pg` connection pool using env vars.

#### [NEW] utils/logger.js
Winston logger with file + console transports.

---

### AI Service — Python Flask

#### [NEW] app.py
Flask app on port 5001, `POST /ai/analyze` endpoint.

#### [NEW] analyzer.py
- Pattern-based log summarization (counts credential leaks, error patterns, failed logins)
- Generates human-readable insight strings
- Anomaly scoring based on pattern frequency
- Falls back gracefully if no OpenAI key configured (pure rule-based)
- Optional: Uses OpenAI GPT-3.5 if `OPENAI_API_KEY` env var is set

---

### Frontend — React + Tailwind (Vite)

#### [NEW] index.css
Full Tailwind base + custom dark SaaS design tokens (slate/indigo/emerald/red palette).

#### [NEW] App.jsx
React Router v6 setup: `/login` → LoginPage, `/` and `/dashboard` → DashboardPage (protected).

#### [NEW] context/AuthContext.jsx
JWT storage in localStorage, auto-login on refresh, login/logout helpers.

#### [NEW] pages/LoginPage.jsx
Split-screen modern login/signup form with animated gradient background, tabs for login/register, form validation.

#### [NEW] pages/DashboardPage.jsx
Full SaaS dashboard: sidebar nav, input method selector, upload zone, analysis trigger, results display.

#### [NEW] components/FileUpload.jsx
Drag-and-drop upload zone supporting PDF, DOCX, TXT, LOG files. Shows file preview + size.

#### [NEW] components/TextInput.jsx
Tabbed textarea for Text / SQL / Chat / Log inputs with syntax hints.

#### [NEW] components/LogViewer.jsx
Line-numbered log display with inline highlighted findings (color per risk level), expandable rows.

#### [NEW] components/InsightsPanel.jsx
AI summary card, anomaly count, insight bullet list, alert banners.

#### [NEW] components/ResultsView.jsx
Findings table: type, line, risk badge, action taken. Overall risk score gauge.

#### [NEW] components/RiskBadge.jsx
Pill badge: Critical=red, High=orange, Medium=yellow, Low=green.

#### [NEW] components/Navbar.jsx
Top navigation with logo, user info, logout.

#### [NEW] services/api.js
Axios instance with base URL + JWT interceptor.

---

### Database Schema

```sql
-- users
CREATE TABLE users (id, email, password_hash, role, created_at);

-- analysis_sessions  
CREATE TABLE analysis_sessions (
  id, user_id, input_type, risk_score, risk_level, action, created_at
);

-- findings
CREATE TABLE findings (
  id, session_id, type, risk_level, line_number, masked_value, created_at
);

-- activity_log
CREATE TABLE activity_log (id, user_id, action, metadata, created_at);
```

---

### Deployment

#### [NEW] docker-compose.yml
Services: `postgres`, `backend` (Node), `ai-service` (Python), `frontend` (nginx).

#### [NEW] Dockerfile.backend / Dockerfile.ai
Multi-stage builds for production.

#### [NEW] README.md
Full setup, env configuration, and run instructions.

---

## Verification Plan

### Automated API Tests (curl commands)
```bash
# 1. Register a user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin1234!","role":"admin"}'

# 2. Login and capture token
curl -X POST http://localhost:3001/auth/login \
  -d '{"email":"admin@test.com","password":"Admin1234!"}'

# 3. Analyze sensitive text
curl -X POST http://localhost:3001/analyze \
  -H "Authorization: Bearer <token>" \
  -d '{"input_type":"text","content":"password=secret123 and api_key=sk-abc123xyz","options":{"mask":true}}'

# 4. Analyze log content
curl -X POST http://localhost:3001/analyze \
  -H "Authorization: Bearer <token>" \
  -d '{"input_type":"log","content":"ERROR: Login failed for user admin\nERROR: Login failed for user admin\npassword=admin123","options":{"log_analysis":true,"mask":true}}'
```

### Frontend Browser Tests (via browser subagent)
- Navigate to `http://localhost:5173`
- Complete login flow
- Upload sample log file and verify highlighted results
- Enter sensitive text and verify masking in results

### Manual Verification Steps
1. Start all services: `docker-compose up` or run individually
2. Visit `http://localhost:5173`
3. Register/login as admin
4. Paste text with `password=test123` and click Analyze
5. Verify: risk score ≥ 8, risk level = "critical", action = "masked", content replaced with `[REDACTED]`
6. Upload `sample-data/sample.log` and verify log viewer shows highlighted lines
