/**
 * Log Analyzer Module
 * Parses log files line-by-line detecting:
 * - Hardcoded credentials
 * - Stack traces / exceptions
 * - Error leaks (HTTP error codes, unhandled exceptions)
 * - Repeated login failures (brute-force patterns)
 * - Suspicious patterns (SQL injection, path traversal, etc.)
 */

const SUSPICIOUS_PATTERNS = [
  {
    type: 'hardcoded_credential',
    risk: 'critical',
    score: 10,
    regex: /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*['"]?([^\s'";&,\]]+)/gi,
    description: 'Hardcoded credential in log',
  },
  {
    type: 'stack_trace',
    risk: 'medium',
    score: 5,
    regex: /(?:at\s+[\w$.]+\s*\(.*:\d+:\d+\)|Traceback|File ".*", line \d+|Exception in thread|java\.lang\.\w+Exception)/i,
    description: 'Stack trace / exception leaked in log',
  },
  {
    type: 'error_leak',
    risk: 'medium',
    score: 4,
    regex: /(?:HTTP\s+(?:500|502|503|504)|Internal Server Error|Unhandled Exception|FATAL|CRITICAL ERROR)/i,
    description: 'Server error information leaked',
  },
  {
    type: 'login_failure',
    risk: 'high',
    score: 7,
    regex: /(?:login\s+failed|authentication\s+failed|invalid\s+(?:credentials?|password|username)|access\s+denied|unauthorized)/i,
    description: 'Authentication failure detected',
  },
  {
    type: 'sql_injection_attempt',
    risk: 'critical',
    score: 10,
    regex: /(?:\bUNION\b.*\bSELECT\b|\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+|DROP\s+TABLE|EXEC\s*\(|xp_cmdshell|SLEEP\s*\(\d+\))/i,
    description: 'Potential SQL injection attempt',
  },
  {
    type: 'path_traversal',
    risk: 'high',
    score: 8,
    regex: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%252e%252e%252f)/i,
    description: 'Path traversal attempt detected',
  },
  {
    type: 'xss_attempt',
    risk: 'high',
    score: 7,
    regex: /<script[^>]*>|javascript\s*:|on(?:load|error|click|mouseover)\s*=/i,
    description: 'Cross-site scripting (XSS) attempt detected',
  },
  {
    type: 'debug_info_leak',
    risk: 'medium',
    score: 4,
    regex: /(?:DEBUG|TRACE|verbose|stack:|\"trace\"\s*:)/i,
    description: 'Debug information exposed in log',
  },
  {
    type: 'ip_suspicious',
    risk: 'low',
    score: 2,
    regex: /(?:from\s+|client\s+|remote\s+)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i,
    description: 'Client IP address logged',
  },
  {
    type: 'sensitive_file_access',
    risk: 'high',
    score: 7,
    regex: /(?:\/etc\/passwd|\/etc\/shadow|\/proc\/|C:\\Windows\\System32|\.env\b|\.pem\b|id_rsa)/i,
    description: 'Sensitive file access detected',
  },
  {
    type: 'dos_attempt',
    risk: 'high',
    score: 8,
    regex: /(?:rate\s+limit\s+exceeded|too\s+many\s+requests|connection\s+flood|syn\s+flood)/i,
    description: 'Potential DoS/DDoS pattern detected',
  },
];

const LOGIN_FAILURE_THRESHOLD = 3; // repeated failures within log = brute force

/**
 * Analyze log content line by line.
 * @param {string} content - Raw log text
 * @returns {object} Structured analysis result
 */
function analyzeLog(content) {
  const lines = content.split('\n');
  const findings = [];
  const loginFailureLines = [];
  const lineAnalysis = [];

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;
    const lineFindings = [];

    SUSPICIOUS_PATTERNS.forEach((pattern) => {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      if (regex.test(line)) {
        lineFindings.push({
          type: pattern.type,
          risk: pattern.risk,
          score: pattern.score,
          line: lineNumber,
          description: pattern.description,
          match: line.trim(),
        });

        if (pattern.type === 'login_failure') {
          loginFailureLines.push(lineNumber);
        }
      }
    });

    lineAnalysis.push({
      lineNumber,
      content: line,
      findings: lineFindings,
      hasSuspiciousContent: lineFindings.length > 0,
    });

    findings.push(...lineFindings);
  });

  // Brute-force detection: 3+ login failures
  let bruteForceDetected = false;
  if (loginFailureLines.length >= LOGIN_FAILURE_THRESHOLD) {
    bruteForceDetected = true;
    findings.push({
      type: 'brute_force',
      risk: 'critical',
      score: 10,
      line: loginFailureLines[0],
      description: `Brute force attack pattern: ${loginFailureLines.length} login failures detected at lines ${loginFailureLines.join(', ')}`,
      match: `${loginFailureLines.length} repeated login failures`,
    });
  }

  // Generate summary statistics
  const stats = {
    totalLines: lines.length,
    suspiciousLines: lineAnalysis.filter((l) => l.hasSuspiciousContent).length,
    findingsByType: groupByType(findings),
    loginFailureCount: loginFailureLines.length,
    bruteForceDetected,
  };

  return {
    findings,
    lineAnalysis,
    stats,
  };
}

function groupByType(findings) {
  return findings.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});
}

module.exports = { analyzeLog };
