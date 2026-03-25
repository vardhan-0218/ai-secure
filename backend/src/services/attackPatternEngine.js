/**
 * Attack Pattern Engine
 * Detects temporal and repetition-based attack patterns:
 * - Brute force login attacks
 * - API abuse / rate limit evasion
 * - Credential stuffing
 * - Suspicious IP concentration
 */

const BRUTE_FORCE_THRESHOLD   = 3;
const API_ABUSE_THRESHOLD     = 10;
const CRED_STUFFING_THRESHOLD = 3;

/**
 * Analyze findings + log lines to detect attack patterns.
 * @param {Array} findings - Enriched finding objects
 * @param {Array} lineAnalysis - Line-by-line log analysis
 * @returns {Array} Detected attack patterns
 */
function detectAttackPatterns(findings, lineAnalysis = []) {
  const patterns = [];

  // ── 1. Brute Force Detection ─────────────────────────────────
  const loginFailures = findings.filter(f =>
    f.type === 'login_failure' || f.type === 'brute_force'
  );

  if (loginFailures.length >= BRUTE_FORCE_THRESHOLD) {
    const lines = loginFailures.map(f => f.line).filter(Boolean);
    const ips = extractIPs(lineAnalysis, lines);
    patterns.push({
      type: 'brute_force',
      severity: 'critical',
      score: 10,
      title: 'Brute Force Attack Detected',
      description: `${loginFailures.length} failed login attempts detected${ips.length ? ` from IP(s): ${[...new Set(ips)].join(', ')}` : ''}. This pattern indicates an automated credential attack.`,
      affectedLines: lines,
      ips: [...new Set(ips)],
      count: loginFailures.length,
      recommendedAction: 'Block offending IPs, enable account lockout, enforce MFA',
    });
  }

  // ── 2. Credential Stuffing Detection ─────────────────────────
  const credTypes = new Set(
    findings.filter(f => ['password', 'secret', 'api_key', 'aws_key', 'openai_key', 'gemini_key'].includes(f.type))
      .map(f => f.type)
  );

  if (credTypes.size >= CRED_STUFFING_THRESHOLD) {
    patterns.push({
      type: 'credential_exposure_cluster',
      severity: 'critical',
      score: 10,
      title: 'Credential Exposure Cluster',
      description: `Multiple credential types exposed simultaneously (${[...credTypes].join(', ')}). This suggests systemic secrets management failure or a compromised configuration file.`,
      affectedTypes: [...credTypes],
      count: credTypes.size,
      recommendedAction: 'Rotate all exposed credentials, audit secrets management pipeline',
    });
  }

  // ── 3. API Key Abuse Pattern ──────────────────────────────────
  const apiKeyFindings = findings.filter(f =>
    ['api_key', 'aws_key', 'openai_key', 'gemini_key', 'bearer_token', 'jwt_token'].includes(f.type)
  );

  if (apiKeyFindings.length >= 2) {
    patterns.push({
      type: 'api_key_exposure',
      severity: 'high',
      score: 8,
      title: 'Multiple API Keys Exposed',
      description: `${apiKeyFindings.length} API/service keys detected. An attacker gaining access to these keys could abuse paid services, exfiltrate data, or gain unauthorized cloud access.`,
      affectedLines: apiKeyFindings.map(f => f.line).filter(Boolean),
      count: apiKeyFindings.length,
      recommendedAction: 'Revoke all exposed keys, audit usage logs for unauthorized calls',
    });
  }

  // ── 4. SQL Injection Campaign ─────────────────────────────────
  const sqlFindings = findings.filter(f => f.type === 'sql_injection_attempt');
  if (sqlFindings.length >= 2) {
    patterns.push({
      type: 'sql_injection_campaign',
      severity: 'critical',
      score: 10,
      title: 'SQL Injection Campaign Detected',
      description: `${sqlFindings.length} SQL injection patterns found across ${sqlFindings.length} locations. This indicates a systematic injection probe of the application.`,
      affectedLines: sqlFindings.map(f => f.line).filter(Boolean),
      count: sqlFindings.length,
      recommendedAction: 'Block attacker IP at WAF, audit all query parameters, implement parameterized queries',
    });
  }

  // ── 5. Security Info Leak Pattern ────────────────────────────
  const leakFindings = findings.filter(f =>
    ['stack_trace', 'error_leak', 'debug_info_leak'].includes(f.type)
  );

  if (leakFindings.length >= 2) {
    patterns.push({
      type: 'information_disclosure',
      severity: 'medium',
      score: 6,
      title: 'Information Disclosure Pattern',
      description: `${leakFindings.length} instances of server internals leaked (stack traces, error details, debug info). Attackers use this data to fingerprint the stack and plan targeted attacks.`,
      affectedLines: leakFindings.map(f => f.line).filter(Boolean),
      count: leakFindings.length,
      recommendedAction: 'Configure production error handling to suppress internal details',
    });
  }

  // ── 6. PII Data Cluster ───────────────────────────────────────
  const piiFindings = findings.filter(f =>
    ['email', 'phone', 'ssn', 'credit_card'].includes(f.type)
  );

  if (piiFindings.length >= 3) {
    patterns.push({
      type: 'pii_cluster',
      severity: 'high',
      score: 8,
      title: 'PII Data Cluster',
      description: `${piiFindings.length} pieces of personally identifiable information (${[...new Set(piiFindings.map(f => f.type))].join(', ')}) found together. This pattern indicates a data leak or improperly protected database dump.`,
      affectedLines: piiFindings.map(f => f.line).filter(Boolean),
      count: piiFindings.length,
      recommendedAction: 'Assess GDPR/CCPA notification obligations, investigate data access controls',
    });
  }

  return patterns.sort((a, b) => b.score - a.score);
}

function extractIPs(lineAnalysis, lineNumbers) {
  const ips = [];
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  lineNumbers.forEach(ln => {
    const lineObj = lineAnalysis.find(l => l.lineNumber === ln);
    if (lineObj?.content) {
      const found = lineObj.content.match(ipRegex);
      if (found) ips.push(...found);
    }
  });
  return ips;
}

module.exports = { detectAttackPatterns };
