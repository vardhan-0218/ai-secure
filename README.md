# AI Secure Data Intelligence Platform

> Enterprise-grade AI-powered security scanning, log analysis, and risk assessment.

## Architecture

```
Data_secure/
├── backend/          Node.js + Express API Gateway  (port 3001)
├── ai-service/       Python Flask AI Service        (port 5001)
├── frontend/         React + Tailwind Dashboard     (port 5173)
└── sample-data/      Test logs and payloads
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+ (running locally)

---

### Step 1 — PostgreSQL Setup

```powershell
# Connect as postgres superuser and create the database
psql -U postgres -c "CREATE DATABASE ai_secure_db;"

# Run the schema
psql -U postgres -d ai_secure_db -f backend/src/db/schema.sql
```

Default seeded admin → `admin@aisecure.dev` / `Admin1234!`

---

### Step 2 — Backend (Node.js)

```powershell
cd backend

# Copy env file and fill in your values
copy .env.example .env

# Install dependencies
npm install

# Start dev server (with auto-reload)
npm run dev
```

**Edit `backend/.env`** — minimum required:
```env
DB_PASSWORD=your_postgres_password
JWT_SECRET=any_long_random_string_here
JWT_REFRESH_SECRET=another_long_random_string_here
```

Backend will start at **http://localhost:3001**  
Health check: http://localhost:3001/health

---

### Step 3 — Python AI Service

```powershell
cd ai-service

# Copy env file
copy .env.example .env

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the service
python app.py
```

**Edit `ai-service/.env`** for LLM integration:
```env
LLM_BACKEND=gemini          # or 'openrouter' or leave blank for rule-based
GEMINI_API_KEY=AIza...      # from https://aistudio.google.com/app/apikey
# OR
OPENROUTER_API_KEY=sk-or-...  # from https://openrouter.ai
OPENROUTER_MODEL=mistralai/mistral-7b-instruct:free
```

AI service starts at **http://localhost:5001**  
> **Optional:** The backend works without the AI service (falls back to rule-based insights automatically).

---

### Step 4 — Frontend (React)

```powershell
cd frontend

npm install

npm run dev
```

Frontend starts at **http://localhost:5173**

---

## Usage Guide

### Login
Navigate to `http://localhost:5173`  
Use seeded admin: `admin@aisecure.dev` / `Admin1234!`  
Or register a new account.

### Analyzing Content

1. **Text/Log/SQL mode** — Paste content in the tabbed textarea
2. **File Upload mode** — Drag & drop `.txt`, `.log`, `.pdf`, `.docx`, `.sql` (up to 20MB)
3. Configure **Analysis Options** (mask, block, log analysis)
4. Click **Run Security Analysis**

### API Usage (direct)

```powershell
# 1. Login
$resp = Invoke-RestMethod -Uri http://localhost:3001/auth/login `
  -Method Post -ContentType "application/json" `
  -Body '{"email":"admin@aisecure.dev","password":"Admin1234!"}'

$token = $resp.accessToken

# 2. Analyze text
Invoke-RestMethod -Uri http://localhost:3001/analyze `
  -Method Post -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body '{"input_type":"text","content":"password=secret123 api_key=sk-abc123","options":{"mask":true}}'

# 3. Test with sample log file
$form = @{ file = Get-Item "sample-data/sample.log"; input_type = "log"; options = "{`"mask`":true,`"log_analysis`":true}" }
Invoke-RestMethod -Uri http://localhost:3001/analyze -Method Post `
  -Headers @{Authorization="Bearer $token"} -Form $form
```

---

## API Contract

### POST /analyze
**Headers:** `Authorization: Bearer <token>`

```json
{
  "input_type": "log | text | file | sql | chat",
  "content": "...",
  "options": {
    "mask": true,
    "block_high_risk": false,
    "log_analysis": true
  }
}
```

**Response:**
```json
{
  "summary": "AI-generated executive summary",
  "risk_score": 9.2,
  "risk_level": "critical",
  "action": "masked",
  "findings": [{ "type": "password", "risk": "critical", "line": 5 }],
  "insights": ["Hardcoded credentials detected..."],
  "processed_content": "password=[REDACTED]"
}
```

### POST /auth/register
```json
{ "email": "user@example.com", "password": "Password1!", "role": "user" }
```

### POST /auth/login
```json
{ "email": "user@example.com", "password": "Password1!" }
```

### GET /analyze/history
Returns last 20 analysis sessions for current user.

---

## Detection Capabilities

| Type | Risk | Pattern |
|------|------|---------|
| Password | Critical | `password=`, `passwd=` |
| AWS Key | Critical | `AKIA...` |
| Gemini Key | Critical | `AIza...` |
| OpenAI Key | Critical | `sk-...` |
| DB Connection | Critical | `postgresql://user:pass@...` |
| JWT Token | High | `eyJ...` |
| API Key | High | `api_key=...` |
| Phone | Medium | `+1-555-...` |
| Email | Low | `user@domain.com` |
| Stack Trace | Medium | Java/Python traces |
| Brute Force | Critical | ≥3 login failures |
| SQL Injection | Critical | `UNION SELECT`, `OR 1=1` |

---

## Risk Levels

| Level | Score | Action |
|-------|-------|--------|
| 🟢 Low | 0–2 | Allowed |
| 🟡 Medium | 3–5 | Allowed / Masked |
| 🔴 High | 6–8 | Masked |
| ⛔ Critical | 9–10 | Masked or Blocked |

---

## Environment Variables Reference

### backend/.env
| Variable | Description |
|----------|-------------|
| `PORT` | API port (default: 3001) |
| `DB_HOST` | PostgreSQL host |
| `DB_NAME` | Database name |
| `DB_USER` | DB username |
| `DB_PASSWORD` | DB password |
| `JWT_SECRET` | JWT signing secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `AI_SERVICE_URL` | Python AI service URL |

### ai-service/.env
| Variable | Description |
|----------|-------------|
| `LLM_BACKEND` | `gemini` / `openrouter` / blank |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_MODEL` | Model ID (default: mistral-7b-instruct:free) |

---

## Troubleshooting

**Backend can't connect to PostgreSQL**
```
DB_PASSWORD not set → edit backend/.env and restart
```

**AI service offline (rule-based used instead)**
```
This is normal — backend auto-falls back. Start ai-service/app.py to enable LLM.
```

**Frontend 401 errors**
```
JWT expired → log out and log in again
```

**Port already in use**
```powershell
netstat -ano | findstr :3001   # find PID
taskkill /PID <pid> /F
```
