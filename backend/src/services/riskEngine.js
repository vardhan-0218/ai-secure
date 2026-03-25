/**
 * Risk Engine
 * Assigns risk scores and levels based on findings.
 */

const RISK_SCORE_MAP = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
};

const RISK_LEVELS = [
  { level: 'critical', minScore: 9 },
  { level: 'high',     minScore: 6 },
  { level: 'medium',   minScore: 3 },
  { level: 'low',      minScore: 0 },
];

/**
 * Calculate overall risk score and level from a list of findings.
 * @param {Array} findings - Array of finding objects with { risk, score }
 * @returns {{ riskScore: number, riskLevel: string, breakdown: object }}
 */
function calculateRisk(findings) {
  if (!findings || findings.length === 0) {
    return { riskScore: 0, riskLevel: 'low', breakdown: {} };
  }

  // Max score wins for critical items, but sum contributes up to cap
  const maxScore = Math.max(...findings.map((f) => f.score || RISK_SCORE_MAP[f.risk] || 0));
  const totalScore = findings.reduce((sum, f) => sum + (f.score || RISK_SCORE_MAP[f.risk] || 0), 0);

  // Weighted: max score dominates, total contributes logarithmically
  const riskScore = Math.min(
    10,
    parseFloat((maxScore * 0.7 + Math.log10(totalScore + 1) * 3).toFixed(1))
  );

  const riskLevel = getRiskLevel(riskScore);

  // Breakdown by type
  const breakdown = findings.reduce((acc, f) => {
    acc[f.type] = acc[f.type] || { count: 0, highestRisk: 'low', highestScore: 0 };
    acc[f.type].count += 1;
    if ((f.score || 0) > acc[f.type].highestScore) {
      acc[f.type].highestScore = f.score || 0;
      acc[f.type].highestRisk = f.risk;
    }
    return acc;
  }, {});

  return { riskScore, riskLevel, breakdown };
}

function getRiskLevel(score) {
  for (const { level, minScore } of RISK_LEVELS) {
    if (score >= minScore) return level;
  }
  return 'low';
}

/**
 * Generate human-readable risk summary.
 */
function generateRiskSummary(riskScore, riskLevel, breakdown) {
  const typeList = Object.keys(breakdown).join(', ');
  if (riskLevel === 'critical') {
    return `⛔ CRITICAL RISK (${riskScore}/10): Extremely sensitive data exposed including ${typeList}. Immediate action required.`;
  } else if (riskLevel === 'high') {
    return `🔴 HIGH RISK (${riskScore}/10): Sensitive data detected: ${typeList}. Remediation recommended.`;
  } else if (riskLevel === 'medium') {
    return `🟡 MEDIUM RISK (${riskScore}/10): Potentially sensitive data found: ${typeList}. Review advised.`;
  } else {
    return `🟢 LOW RISK (${riskScore}/10): Minimal sensitive data detected: ${typeList || 'none'}.`;
  }
}

module.exports = { calculateRisk, getRiskLevel, generateRiskSummary };
