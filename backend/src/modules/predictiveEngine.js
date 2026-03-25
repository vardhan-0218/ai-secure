/**
 * Predictive Threat Engine
 * Wraps the AI prediction service and formats results for frontend consumption.
 */

const { getPredictions } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Run predictive threat analysis on enriched findings.
 * @param {Array} findings - Enriched findings from analysis
 * @param {Array} timeline - Timeline events from the analysis
 * @param {object} context - Additional context (inputType, riskLevel, etc.)
 * @returns {Promise<object>} Predictive threat analysis result
 */
async function runPredictiveAnalysis(findings, timeline = [], context = {}) {
  try {
    logger.info(`Predictive engine: analyzing ${findings.length} findings`);
    const result = await getPredictions(findings, timeline, context);
    return {
      ...result,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`Predictive analysis error: ${err.message}`);
    return {
      threat_trajectory: 'Predictive analysis failed',
      attack_stage: 'unknown',
      predictions: [],
      blast_radius: { affected_systems: [], potential_data_loss: 'N/A', business_impact: 'N/A' },
      urgency: 'unknown',
      confidence: 0,
      mode: 'error',
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = { runPredictiveAnalysis };
