# AI Secure Data Intelligence Platform 🛡️

The AI Secure Data Intelligence Platform is an enterprise-grade security analysis tool designed to ingest, process, and analyze raw logs, SQL queries, and freeform text to identify sophisticated threat actors, vulnerabilities, and data leaks using real-time generative AI.

This system is built entirely on a persistent, multi-microservice architecture featuring **Live WebSocket Log Streaming**, **Reactive Frontends**, and a dedicated **Python AI Pipeline**.

---

## 🏗️ Architecture Stack

1. **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons (Running on port `5173`)
2. **Backend**: Node.js, Express, WebSockets, PostgreSQL (Running on port `3001`)
3. **AI Service**: Python, Flask, Google Gemini API (Running on port `5000`)

---

## ⚙️ Global Prerequisites

Before you begin, ensure your system has the following installed:
- **Node.js**: v18.0.0+ 
- **Python**: v3.10+
- **PostgreSQL**: v14.0+
- **Google Gemini API Key**: Acquired via Google AI Studio

---

## 🚀 Setup Instructions

### 1. Database Setup (PostgreSQL)
1. Ensure your local PostgreSQL service is running.
2. Open your preferred SQL interface (pgAdmin, DBeaver, or psql cli) and create a database named `ai_secure`.
3. Locate the schema file in the project directory: `backend/src/db/schema.sql`.
4. Run the contents of `schema.sql` against the `ai_secure` database to build the tables. (This enables the `uuid-ossp` extension automatically).

### 2. Backend API Service
Navigate into the `backend/` directory from the root of the project.

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=3001
JWT_SECRET=YOUR_SUPER_SECRET_JWT_SIGNATURE_KEY
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_secure
AI_SERVICE_URL=http://127.0.0.1:5000
```

Start the backend server:
```bash
node server.js
```
*(You should see "✅ PostgreSQL connected" and "🔌 AI WebSocket stream server initialized" in your terminal).*

### 3. AI Intelligence Service
Navigate into the `ai-service/` directory.

```bash
cd ai-service
pip install -r requirements.txt
```

Create a `.env` file in the `ai-service/` directory:
```env
PORT=5000
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
```

Start the Flask AI engine:
```bash
python app.py
```
*(You should see "Running on http://127.0.0.1:5000" in your terminal).*

### 4. Frontend React Dashboard
Navigate into the `frontend/` directory.

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory (Optional depending on default proxying):
```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

Start the React development server:
```bash
npm run dev
```

---

## 🔐 System Administrator Initialization

To unlock the Admin Hub and User Purging features, you must manually seed an Admin account into the database via the included CLI tool.

Open a new terminal, navigate to the `backend/` directory, and run the seeder:

```bash
node tools/seedAdmin.js admin@example.com MySecurePassword123
```

You can now use these credentials to log into the frontend application.

---

## 📡 Core Features & Operation

- **Static Analysis**: Jump to the "Analyze" tab to paste static blocks of logs, code, or upload log files for an immediate total-scan.
- **Micro-Chunk Sequence AI (Live Stream)**: Jump to the "Live Stream" tab and paste hundreds of lines of raw logs. The WebSocket engine will sequentially chunk your logs, stream them to the AI, and natively construct exact predictive timelines, attack stages, and lateral movement projections dynamically.
- **Post-Mortem History Viewer**: Click your History tab to view massive, persistent historical retrospectives of previously scanned payloads, perfectly mapping AI Remediation Suggestions directly to literal line numbers extracted from old threats.
- **Admin Hub**: As an Admin, you wield full power to oversee the analytics of your entire platform, including global user deletion, historical cascades, and security-event distributions.
