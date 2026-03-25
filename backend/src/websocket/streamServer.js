/**
 * Production-Grade WebSocket Stream Server
 * =========================================
 * Architecture:
 *   Client sends log content → backend splits into chunks (CHUNK_SIZE lines)
 *   → AI analyzes each chunk async → results emitted back over WS in real-time
 *
 * Events emitted to client:
 *   connected         - welcome frame on connect
 *   pong              - keepalive response
 *   chunk_start       - chunk processing began
 *   chunk_ai_result   - AI result for a chunk (findings, risk, commentary)
 *   stream_alert      - critical/high alert from AI
 *   stream_prediction - live prediction update
 *   stream_progress   - progress counter
 *   stream_complete   - all chunks processed, final summary
 *   error             - stream processing error
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { analyzeChunk } = require('../services/aiService');
const { aiStreamQueue } = require('../services/queueManager');
const sessionManager = require('../services/sessionMemory');

const CHUNK_SIZE = 20; // Lines per AI chunk
const MAX_CONCURRENT_CHUNKS = 3; // Max parallel AI calls per stream session

let wss = null;
// Map: userId → Set<WebSocket>
const clients = new Map();

// ─── Init ─────────────────────────────────────────────────────────────────────

function initWebSocketServer(httpServer) {
  wss = new WebSocket.Server({ server: httpServer, path: '/stream' });

  wss.on('connection', (ws, req) => {
    const urlParams = new URL(req.url, 'http://localhost').searchParams;
    const token = urlParams.get('token');
    let userId = null;

    // Require auth for streaming to prevent cross-user data exposure.
    if (!token) {
      send(ws, { type: 'error', message: 'Authentication token required', code: 4001 });
      ws.close(4001, 'Auth required');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      send(ws, { type: 'error', message: 'Invalid authentication token', code: 4001 });
      ws.close(4001, 'Invalid token');
      return;
    }

    logger.info(`WS connected: user=${userId}`);
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(ws);

    // Welcome frame + capability info
    send(ws, {
      type: 'connected',
      message: 'AI-powered real-time log stream active',
      capabilities: ['ai_chunk_analysis', 'real_time_alerts', 'predictions', 'escalation_detection', 'queue_backpressure_support'],
      timestamp: new Date().toISOString(),
    });

    // Send initial queue stats
    send(ws, { type: 'queue_stats', stats: { active: 0, queued: 0, processed: 0, failed: 0, retried: 0, backpressure: false } });

    // Setup heartbeat
    ws._isAlive = true;
    ws.on('pong', () => { ws._isAlive = true; });

    // Message handler
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'ping') {
          send(ws, { type: 'pong', timestamp: new Date().toISOString() });
          return;
        }

        if (msg.type === 'stream_log' && msg.content) {
          await streamAndAnalyze(msg.content, ws, userId, msg.sessionId);
        }

        if (msg.type === 'cancel_stream') {
          ws._cancelStream = true;
          send(ws, { type: 'stream_cancelled', timestamp: new Date().toISOString() });
        }

      } catch (err) {
        logger.warn(`WS message parse error: ${err.message}`);
      }
    });

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      logger.debug(`WS disconnected: user=${userId}`);
    });

    ws.on('error', (err) => logger.warn(`WS error [${userId}]: ${err.message}`));
  });

  // Heartbeat interval
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws._isAlive === false) return ws.terminate();
      ws._isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
  
  // Broadcast global queue stats to all clients when they change
  aiStreamQueue.on('stats', (stats) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        send(client, { type: 'queue_stats', stats, timestamp: new Date().toISOString() });
      }
    });
  });
  
  logger.info('🔌 AI WebSocket stream server initialized at ws://localhost:3001/stream');
  return wss;
}

// ─── Core: Chunk-based AI Streaming ──────────────────────────────────────────

async function streamAndAnalyze(content, ws, userId, incomingSessionId) {
  ws._cancelStream = false;
  const lines = content.split('\n');
  const chunks = chunkLines(lines, CHUNK_SIZE);
  const totalChunks = chunks.length;

  // Initialize unified session memory
  let sessionId = null;
  const existing = incomingSessionId ? sessionManager.getSession(incomingSessionId) : null;
  if (existing && existing.userId === userId) {
    sessionId = incomingSessionId;
  } else {
    sessionId = sessionManager.createSession(userId, 'stream');
  }
  const session = sessionManager.getSession(sessionId);
  
  // Local context fallback (in case Python memory resets during restart)
  const sessionContext = {
    total_findings_so_far: session.chunksProcessed ? session.totalRisk : 0,
    current_risk_level: 'clean',
    patterns_seen: [],
    session_id: sessionId,
  };

  send(ws, {
    type: 'stream_start',
    totalLines: lines.length,
    totalChunks,
    chunkSize: CHUNK_SIZE,
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
  });

  // Process chunks by pushing them into the global AI queue
  let chunkIndex = 0;
  const allFindings = [];

  for (let i = 0; i < chunks.length; i++) {
    if (ws.readyState !== WebSocket.OPEN || ws._cancelStream) break;

    const ci = i;
    const chunkContent = chunks[ci];

    // Notify chunk start
    send(ws, {
      type: 'chunk_start',
      chunk_index: ci,
      start_line: ci * CHUNK_SIZE + 1,
      end_line: Math.min((ci + 1) * CHUNK_SIZE, lines.length),
      timestamp: new Date().toISOString(),
    });

    try {
      // Enqueue in global queue (handles backpressure + retries)
      // We process sequentially at the loop level but the queue handles concurrency system-wide
      const result = await aiStreamQueue.enqueue(() => analyzeChunk(chunkContent, ci, sessionId), { priority: 1, retries: 2 });
      
      if (ws.readyState !== WebSocket.OPEN || ws._cancelStream) break;
      if (!result) continue;

      // Accumulate session context
      const newFindings = result.findings || [];
      allFindings.push(...newFindings);
      sessionContext.total_findings_so_far += newFindings.length;
      sessionManager.incrementChunks(sessionId);
      
      if (result.chunk_risk_level && result.chunk_risk_level !== 'clean') {
        sessionContext.current_risk_level = escalateRisk(sessionContext.current_risk_level, result.chunk_risk_level);
      }
      if (result.new_patterns?.length) {
        sessionContext.patterns_seen.push(...result.new_patterns);
      }

      // Emit chunk result
      send(ws, {
        type: 'chunk_ai_result',
        chunk_index: ci,
        start_line: ci * CHUNK_SIZE + 1,
        end_line: Math.min((ci + 1) * CHUNK_SIZE, lines.length),
        findings: newFindings,
        chunk_risk_level: result.chunk_risk_level,
        chunk_risk_score: result.chunk_risk_score || 0,
        escalation: result.escalation || { detected: false },
        anomalies: result.anomalies || [],
        ai_commentary: result.ai_commentary || '',
        new_patterns: result.new_patterns || [],
        // Never send raw secrets to the browser in real-time streams.
        chunk_content_masked: maskSensitiveForStream(chunkContent),
        session_totals: {
           findings: sessionContext.total_findings_so_far,
           risk_level: sessionContext.current_risk_level,
        },
        timestamp: new Date().toISOString(),
      });

      // Emit real-time alerts for critical/high
      for (const finding of newFindings) {
        if (finding.risk === 'critical' || finding.risk === 'high') {
          send(ws, {
            type: 'stream_alert',
            severity: finding.risk,
            finding_type: finding.type,
            description: finding.description,
            chunk_index: ci,
            ai_reasoning: result.ai_commentary,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Emit escalation alert
      if (result.escalation?.detected) {
        send(ws, {
          type: 'stream_alert',
          severity: 'high',
          finding_type: 'escalation',
          description: result.escalation.explanation,
          chunk_index: ci,
          timestamp: new Date().toISOString(),
        });
      }

      // Emit progress
      send(ws, {
        type: 'stream_progress',
        chunks_done: ci + 1,
        total_chunks: totalChunks,
        percent: Math.round(((ci + 1) / totalChunks) * 100),
        timestamp: new Date().toISOString(),
      });

    } catch (err) {
      logger.error(`Stream chunk ${ci} permanently failed: ${err.message}`);
      send(ws, { type: 'chunk_error', chunk_index: ci, message: err.message });
    }

    // Very small yield
    await delay(50);
  }

  // Final summary
  const riskSummary = buildRiskSummary(allFindings, sessionContext);
  send(ws, {
    type: 'stream_complete',
    totalLines: lines.length,
    totalChunks,
    totalFindings: allFindings.length,
    finalRiskLevel: sessionContext.current_risk_level,
    summary: riskSummary,
    all_findings: allFindings.slice(0, 100),
    timestamp: new Date().toISOString(),
  });

  logger.info(`Stream complete: user=${userId}, ${lines.length} lines, ${totalChunks} chunks, ${allFindings.length} findings`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkLines(lines, size) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size).join('\n'));
  }
  return chunks;
}

const RISK_ORDER = ['clean', 'low', 'medium', 'high', 'critical'];
function escalateRisk(current, incoming) {
  const ci = RISK_ORDER.indexOf(current);
  const ii = RISK_ORDER.indexOf(incoming);
  return ii > ci ? incoming : current;
}

function buildRiskSummary(findings, sessionContext) {
  if (findings.length === 0) return 'Stream complete. No security issues detected.';
  const critCount = findings.filter(f => f.risk === 'critical').length;
  const highCount = findings.filter(f => f.risk === 'high').length;
  return `Stream analysis complete. Found ${findings.length} security issue(s) — ${critCount} critical, ${highCount} high. Overall risk: ${sessionContext.current_risk_level.toUpperCase()}.`;
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (err) {
      logger.warn(`WS send error: ${err.message}`);
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function maskSensitiveForStream(text) {
  if (!text) return '';
  let out = String(text);

  // Common credential-like fields.
  out = out.replace(/(password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*(\S+)/gi, (_m, k) => {
    return `${k}: [REDACTED]`;
  });

  // AWS access key
  out = out.replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA...: [REDACTED]');

  // Generic JWT-ish tokens (best-effort; avoids heavy regex)
  out = out.replace(/\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g, 'JWT: [REDACTED]');

  return out;
}

// ─── Broadcast Utilities ──────────────────────────────────────────────────────

function broadcastAlert(userId, alert) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  userClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) send(ws, { type: 'alert', ...alert });
  });
}

function broadcastToAll(message) {
  if (!wss) return;
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) send(ws, message);
  });
}

module.exports = { initWebSocketServer, broadcastAlert, broadcastToAll };
