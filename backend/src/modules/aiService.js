/**
 * AI Service Bridge (Node.js → Python AI Service)
 * All intelligence comes from the Python AI service (LLM-powered).
 * This module handles transport, retries, and graceful degradation.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS || '45000');

/**
 * Execute an async function with built-in retries and exponential backoff.
 */
async function _withRetry(fn, retries = 2, delay = 1500) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        logger.warn(`AI Service request failed (${err.message}). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Full AI analysis of content.
 * Returns: { findings, root_cause, predictions, fix_suggestions, anomalies, risk_score, confidence, summary, mode }
 */
async function getAIInsights(payload, sessionId = null) {
  try {
    return await _withRetry(async () => {
      const response = await axios.post(`${AI_SERVICE_URL}/ai/analyze`, {
        content: payload.content,
        session_id: sessionId,
        context: {
          inputType: payload.inputType,
          riskLevel: payload.riskLevel,
          riskScore: payload.riskScore,
          stats: payload.stats || {},
          findingsCount: (payload.findings || []).length,
        },
      }, { timeout: AI_TIMEOUT });
      return response.data;
    }, 2);
  } catch (err) {
    logger.error(`AI getInsights failed permanently after retries: ${err.message}`);
    return _minimalFallback(payload);
  }
}
async function getAIInsights(payload) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/ai/analyze`, {
      content: payload.content,
      context: {
        inputType: payload.inputType,
        riskLevel: payload.riskLevel,
        riskScore: payload.riskScore,
        stats: payload.stats || {},
        findingsCount: (payload.findings || []).length,
      },
    }, { timeout: AI_TIMEOUT });
    return response.data;
  } catch (err) {
    logger.error(`AI getInsights failed: ${err.message}`);
    return _minimalFallback(payload);
  }
}

/**
 * Analyze a single log chunk during real-time streaming.
 * Returns: { chunk_index, findings, chunk_risk_level, escalation, anomalies, ai_commentary, new_patterns }
 */
async function analyzeChunk(chunk, chunkIndex, sessionId = null) {
  try {
    return await _withRetry(async () => {
      const response = await axios.post(`${AI_SERVICE_URL}/ai/analyze/chunk`, {
        chunk,
        chunk_index: chunkIndex,
        session_id: sessionId,
      }, { timeout: 35000 });
      return response.data;
    }, 2);
  } catch (err) {
    logger.warn(`AI chunk analysis failed (chunk ${chunkIndex}): ${err.message}`);
    return {
      chunk_index: chunkIndex,
      findings: [],
      chunk_risk_level: 'unknown',
      chunk_risk_score: 0,
      escalation: { detected: false, explanation: 'AI service unavailable' },
      anomalies: [],
      ai_commentary: 'AI analysis currently unavailable for this chunk.',
      new_patterns: [],
      mode: 'error',
    };
  }
}

/**
 * Context-aware AI chat with conversation memory.
 * Returns: { reply, confidence, referenced_findings, follow_up_suggestions }
 */
async function getAIChat(message, sessionId = null, analysisContext = null) {
  try {
    return await _withRetry(async () => {
      const response = await axios.post(`${AI_SERVICE_URL}/ai/chat`, {
        message,
        session_id: sessionId,
        context: analysisContext || {},
      }, { timeout: 35000 });
      return response.data;
    }, 1);
  } catch (err) {
    logger.warn(`AI chat failed: ${err.message}`);
    return {
      reply: 'AI chat service is currently unreachable. Please try again in a few moments.',
      confidence: 0,
      referenced_findings: [],
      follow_up_suggestions: []
    };
  }
}

/**
 * Predictive threat analysis.
 * Returns: { threat_trajectory, attack_stage, predictions, blast_radius, urgency, confidence }
 */
async function getPredictions(findings, timeline, context) {
  try {
    return await _withRetry(async () => {
      const response = await axios.post(`${AI_SERVICE_URL}/ai/predict`, {
        findings: findings || [],
        timeline: timeline || [],
        context: context || {},
      }, { timeout: 40000 });
      return response.data;
    }, 1);
  } catch (err) {
    logger.warn(`AI predictions failed: ${err.message}`);
    return {
      threat_trajectory: 'Unable to generate predictions — AI service unavailable',
      attack_stage: 'unknown',
      predictions: [],
      blast_radius: { affected_systems: [], potential_data_loss: 'Unknown', business_impact: 'Unknown' },
      urgency: 'unknown',
      confidence: 0,
      mode: 'error',
    };
  }
}

/**
 * Cross-log AI correlation.
 * Returns: { correlations, attack_chain, threat_actor_profile, summary }
 */
async function getCorrelations(logsContext) {
  try {
    return await _withRetry(async () => {
      const response = await axios.post(`${AI_SERVICE_URL}/ai/correlate`, {
        logs_context: logsContext,
      }, { timeout: 40000 });
      return response.data;
    }, 1);
  } catch (err) {
    logger.warn(`AI correlation failed: ${err.message}`);
    return {
      correlations: [],
      attack_chain: 'Correlation unavailable',
      threat_actor_profile: { sophistication: 'unknown', objectives: [], ttps: [] },
      summary: 'AI correlation service unavailable.',
      mode: 'error',
    };
  }
}

/**
 * Minimal fallback if AI service is completely down.
 * Returns a placeholder so the API doesn't crash.
 */
function _minimalFallback(payload) {
  const findings = payload.findings || [];
  const count = findings.length;
  return {
    findings,
    root_cause: count > 0
      ? `${count} security issue(s) detected. AI reasoning temporarily unavailable — please check your API key configuration.`
      : 'No issues detected.',
    predictions: [],
    fix_suggestions: count > 0 ? [{ priority: 'immediate', action: 'Review findings and rotate any exposed credentials.', code_example: '', finding_types: [] }] : [],
    anomalies: [],
    risk_score: payload.riskScore || Math.min(count * 2, 10),
    confidence: 0,
    summary: `Analysis complete. Found ${count} issue(s). AI reasoning unavailable — check GEMINI_API_KEY or OPENROUTER_API_KEY in ai-service/.env`,
    insights: count > 0 ? [`${count} security finding(s) require review.`] : ['No issues found.'],
    mode: 'fallback',
  };
}

module.exports = { getAIInsights, analyzeChunk, getAIChat, getPredictions, getCorrelations };
