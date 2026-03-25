const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { detectSensitiveData } = require('../services/detectionEngine');
const { calculateRisk, generateRiskSummary } = require('../services/riskEngine');
const { applyPolicy } = require('../services/policyEngine');
const { getAIInsights, getCorrelations } = require('../services/aiService');
const { runPredictiveAnalysis } = require('../services/predictiveEngine');
const { createAlert } = require('./alertsController');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

const handleAnalyze = async (req, res) => {
  const startTime = Date.now();
  let content = '';
  let inputType = 'text';
  let uploadedFilename = null;
  let uploadedSize = null;
  let uploadedMime = null;

  try {
    // 1. Extract content
    if (req.file) {
      inputType = 'file';
      uploadedFilename = req.file.originalname || null;
      uploadedSize = req.file.size || null;
      uploadedMime = req.file.mimetype || null;
      content = fs.readFileSync(req.file.path, 'utf-8');
      fs.unlinkSync(req.file.path);
    } else {
      content   = req.body.content || '';
      inputType = req.body.input_type || 'text';
    }

    const options = req.body.options
      ? (typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options)
      : { mask: true, block_high_risk: false, log_analysis: true };

    if (!content.trim()) return sendError(res, 400, 'Content is required');

    // 2. AI-FIRST analysis (primary engine)
    logger.info(`Analysis started: ${inputType}, ${content.length} chars`);
    
    // We create a UUID upfront to act as the unified session ID
    // for both the Database and the Python AI Memory engine.
    const unifiedSessionId = uuidv4();

    const aiResult = await getAIInsights({
      content: content.substring(0, 4000),
      inputType,
      riskLevel: 'unknown',
      riskScore: 0,
      stats: { contentLength: content.length },
    }, unifiedSessionId);

    // 3. Merge AI findings with regex pre-filter enrichment (secondary)
    const regexFindings = detectSensitiveData(content); // Keep for line numbers
    const aiFindings = aiResult.findings || [];

    // Enrich AI findings with line numbers from regex where type matches
    const enrichedFindings = aiFindings.map(af => {
      const match = regexFindings.find(rf => rf.type === af.type || af.type?.includes(rf.type));
      return {
        ...af,
        line: af.line || match?.line || null,
        fixSuggestions: (aiResult.fix_suggestions || [])
          .filter(s => !s.finding_types?.length || s.finding_types.includes(af.type))
          .map(s => s.action),
        rootCause: aiResult.root_cause || '',
      };
    });

    // Add any regex-only findings not caught by AI (e.g., specific line references)
    const aiTypes = new Set(aiFindings.map(f => f.type));
    for (const rf of regexFindings) {
      if (!aiTypes.has(rf.type)) {
        enrichedFindings.push({
          ...rf,
          rootCause: aiResult.root_cause || '',
          fixSuggestions: [],
        });
      }
    }

    // 4. Risk scoring (AI provides score, calculate also for breakdown)
    const aiRiskScore = aiResult.risk_score || 0;
    const { riskScore: regexScore, riskLevel, breakdown } = calculateRisk(regexFindings.length > 0 ? regexFindings : aiFindings);
    // Blend: AI score is primary (70%), regex backup is secondary (30%)
    const finalRiskScore = enrichedFindings.length > 0
      ? Math.round((aiRiskScore * 0.7 + regexScore * 0.3) * 10) / 10
      : aiRiskScore;
    const finalRiskLevel = scoreToLevel(finalRiskScore);
    const riskSummary = generateRiskSummary(finalRiskScore, finalRiskLevel, breakdown);

    // 5. Policy (masking/blocking)
    const { processedContent, action, maskedCount } = applyPolicy(content, enrichedFindings, finalRiskLevel, options);

    // 6. Predictive analysis (AI)
    const timeline = buildTimeline(enrichedFindings);
    const predictions = await runPredictiveAnalysis(enrichedFindings, timeline, {
      inputType,
      riskLevel: finalRiskLevel,
      riskScore: finalRiskScore,
    });

    // 7. Correlation (AI)
    const correlation = await getCorrelations({
      findings: enrichedFindings,
      risk_level: finalRiskLevel,
      input_type: inputType,
      content_excerpt: content.substring(0, 1000),
    });

    const processingMs = Date.now() - startTime;

    // 8. Persist to DB
    try {
      await pool.query(
        `INSERT INTO analysis_sessions
          (id,user_id,input_type,content_length,risk_score,risk_level,action,ai_summary,processing_ms,uploaded_filename,uploaded_size,uploaded_mime)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [unifiedSessionId, req.user.id, inputType, content.length, finalRiskScore, finalRiskLevel, action, aiResult.summary, processingMs, uploadedFilename, uploadedSize, uploadedMime]
      );

      for (const f of enrichedFindings.slice(0, 50)) {
        await pool.query(
          `INSERT INTO findings (id,session_id,finding_type,risk_level,risk_score,line_number,description,masked_value)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv4(), unifiedSessionId, f.type, f.risk, f.score || 0, f.line || null, f.description, f.match?.substring(0, 100) || null]
        );
      }

      if (finalRiskLevel === 'critical' || finalRiskLevel === 'high') {
        await createAlert(req.user.id, unifiedSessionId, 'risk_detected', finalRiskLevel,
          `${finalRiskLevel.toUpperCase()} risk — ${enrichedFindings.length} finding(s). ${aiResult.summary?.substring(0, 200) || ''}`);
      }

      await pool.query(
        'INSERT INTO activity_log (user_id,action,metadata) VALUES ($1,$2,$3)',
        [req.user.id, 'analyze', JSON.stringify({ inputType, finalRiskLevel, finalRiskScore, findingsCount: enrichedFindings.length, aiMode: aiResult.mode })]
      );
    } catch (dbErr) {
      logger.warn(`DB persist (non-fatal): ${dbErr.message}`);
    }

    // 9. Build response
    return sendSuccess(res, {
      session_id: unifiedSessionId,
      // AI-primary fields
      summary: aiResult.summary,
      root_cause: aiResult.root_cause,
      predictions: predictions.predictions || [],
      threat_trajectory: predictions.threat_trajectory,
      attack_stage: predictions.attack_stage,
      blast_radius: predictions.blast_radius,
      fix_suggestions: aiResult.fix_suggestions || [],
      anomalies: aiResult.anomalies || [],
      confidence: aiResult.confidence || 0,
      correlation: correlation,
      // Risk
      risk_score: finalRiskScore,
      risk_level: finalRiskLevel,
      risk_breakdown: breakdown,
      riskSummary,
      // Findings
      findings: enrichedFindings.map(f => ({
        type: f.type,
        risk: f.risk,
        score: f.score,
        line: f.line,
        description: f.description,
        rootCause: f.rootCause,
        fixSuggestions: f.fixSuggestions,
        match_hint: f.match_hint || f.match?.substring(0, 50),
      })),
      // Content
      content_type: inputType,
      action,
      masked_count: maskedCount,
      processed_content: processedContent,
      // Legacy / compat
      insights: (aiResult.fix_suggestions || []).map(s => s.action).filter(Boolean),
      attackPatterns: [], // Deprecated — now in predictions
      // Stats
      stats: {
        totalFindings: enrichedFindings.length,
        processingMs,
        aiMode: aiResult.mode || 'ai',
        confidenceScore: aiResult.confidence,
        contentLength: content.length,
      },
      // Timeline
      timeline,
    });

    logger.info(`Analysis complete: ${inputType} | ${finalRiskLevel} (${finalRiskScore}) | ${enrichedFindings.length} findings | ${processingMs}ms | mode=${aiResult.mode}`);

  } catch (err) {
    logger.error(`Analysis error: ${err.message}`, { stack: err.stack });
    return sendError(res, 500, 'Analysis failed', { detail: err.message });
  }
};

const getAnalysisHistory = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await pool.query(
      `SELECT id,input_type,risk_score,risk_level,action,processing_ms,created_at
            ,uploaded_filename,uploaded_size,uploaded_mime
       FROM analysis_sessions WHERE user_id=$1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, Math.min(parseInt(limit), 100), parseInt(offset)]
    );
    return sendSuccess(res, { sessions: result.rows, count: result.rows.length });
  } catch {
    return sendError(res, 500, 'Failed to fetch history');
  }
};

const getAnalysisSession = async (req, res) => {
  try {
    const session  = await pool.query('SELECT * FROM analysis_sessions WHERE id=$1 AND user_id=$2', [req.params.sessionId, req.user.id]);
    if (!session.rows.length) return sendError(res, 404, 'Session not found');
    const findings = await pool.query('SELECT * FROM findings WHERE session_id=$1 ORDER BY line_number ASC', [req.params.sessionId]);
    return sendSuccess(res, { session: session.rows[0], findings: findings.rows });
  } catch {
    return sendError(res, 500, 'Failed to fetch session');
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreToLevel(score) {
  if (score >= 8) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  if (score > 0)  return 'low';
  return 'clean';
}

function buildTimeline(findings) {
  const now = Date.now();
  return findings.slice(0, 30).map((f, i) => ({
    time: new Date(now - (findings.length - i) * 1500).toISOString(),
    type: 'finding',
    label: f.type,
    risk: f.risk,
    line: f.line,
    description: f.description,
  })).sort((a, b) => new Date(a.time) - new Date(b.time));
}

module.exports = {
  handleAnalyze,
  getAnalysisHistory,
  getAnalysisSession
};
