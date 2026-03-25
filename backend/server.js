require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');

const { globalLimiter } = require('./src/middleware/rateLimiter');
const logger = require('./src/utils/logger');
const { sendError, sendSuccess } = require('./src/utils/response');
const analyzeRouter = require('./src/routes/analyze');
const authRouter   = require('./src/routes/auth');
const chatRouter   = require('./src/routes/chat');
const alertsRouter = require('./src/routes/alerts');
const adminRouter  = require('./src/routes/admin');
const { initWebSocketServer } = require('./src/websocket/streamServer');

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Rate limiting
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  return sendSuccess(res, {
    status: 'ok',
    service: 'AI Secure Data Intelligence Platform',
    version: '2.0.0',
    features: ['detection', 'log-analysis', 'risk-engine', 'ai-insights', 'websocket', 'chat', 'attack-patterns', 'root-cause', 'correlation', 'alerts'],
    websocket: `ws://localhost:${PORT}/stream`,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/auth',    authRouter);
app.use('/analyze', analyzeRouter);
app.use('/chat',    chatRouter);
app.use('/alerts',  alertsRouter);
app.use('/admin',   adminRouter);

// 404
app.use((req, res) => sendError(res, 404, 'Route not found'));

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  if (process.env.NODE_ENV === 'development') {
    return sendError(res, err.status || 500, err.message || 'Internal Server Error', { stack: err.stack });
  }
  return sendError(res, err.status || 500, err.message || 'Internal Server Error');
});

// Create HTTP server + attach WebSocket
const httpServer = http.createServer(app);
initWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`🚀 AI Secure Backend v2.0 on http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket → ws://localhost:${PORT}/stream`);
  logger.info(`🤖 Chat      → POST /chat`);
  logger.info(`🔔 Alerts    → GET /alerts`);
  logger.info(`📊 Env: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
