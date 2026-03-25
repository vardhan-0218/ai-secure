/**
 * Detection Engine
 * Regex-based sensitive data detection for emails, phones, API keys,
 * passwords, tokens, SSNs, credit cards, and more.
 */

const PATTERNS = [
  {
    type: 'password',
    risk: 'critical',
    score: 10,
    regex: /(?:password|passwd|pwd|pass)\s*[:=]\s*['"]?([^\s'";&,]+)/gi,
    description: 'Hardcoded password detected',
  },
  {
    type: 'secret',
    risk: 'critical',
    score: 10,
    regex: /(?:secret|private_key|client_secret)\s*[:=]\s*['"]?([^\s'";&,]+)/gi,
    description: 'Secret/private key exposed',
  },
  {
    type: 'api_key',
    risk: 'high',
    score: 8,
    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9\-_]{16,})/gi,
    description: 'API key detected',
  },
  {
    type: 'aws_key',
    risk: 'critical',
    score: 10,
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    description: 'AWS Access Key ID detected',
  },
  {
    type: 'openai_key',
    risk: 'critical',
    score: 10,
    regex: /\b(sk-[A-Za-z0-9]{32,})\b/g,
    description: 'OpenAI/Service API key detected',
  },
  {
    type: 'gemini_key',
    risk: 'critical',
    score: 10,
    regex: /\b(AIza[A-Za-z0-9_\-]{35})\b/g,
    description: 'Google/Gemini API key detected',
  },
  {
    type: 'jwt_token',
    risk: 'high',
    score: 8,
    regex: /\b(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\b/g,
    description: 'JWT token detected',
  },
  {
    type: 'bearer_token',
    risk: 'high',
    score: 7,
    regex: /Bearer\s+([A-Za-z0-9\-_.~+/]+=*)/gi,
    description: 'Bearer token detected',
  },
  {
    type: 'private_key_block',
    risk: 'critical',
    score: 10,
    regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
    description: 'PEM private key block detected',
  },
  {
    type: 'email',
    risk: 'low',
    score: 3,
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g,
    description: 'Email address detected',
  },
  {
    type: 'phone',
    risk: 'medium',
    score: 5,
    regex: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
    description: 'Phone number detected',
  },
  {
    type: 'ssn',
    risk: 'critical',
    score: 10,
    regex: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    description: 'Social Security Number detected',
  },
  {
    type: 'credit_card',
    risk: 'critical',
    score: 10,
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    description: 'Credit card number detected',
  },
  {
    type: 'db_connection_string',
    risk: 'critical',
    score: 10,
    regex: /(?:mysql|postgresql|postgres|mongodb|redis):\/\/[^\s'"]+/gi,
    description: 'Database connection string with credentials detected',
  },
  {
    type: 'ip_address',
    risk: 'low',
    score: 2,
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    description: 'IP address detected',
  },
];

/**
 * Run detection on a text string.
 * @param {string} content - Raw text to scan
 * @returns {{ findings: Array, sensitiveMatches: Array }}
 */
function detectSensitiveData(content) {
  const findings = [];
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    PATTERNS.forEach((pattern) => {
      // Reset regex state
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(line)) !== null) {
        findings.push({
          type: pattern.type,
          risk: pattern.risk,
          score: pattern.score,
          line: lineIndex + 1,
          column: match.index + 1,
          match: match[0],
          description: pattern.description,
        });
      }
    });
  });

  return findings;
}

/**
 * Get all patterns for external inspection.
 */
function getPatterns() {
  return PATTERNS.map(({ type, risk, score, description }) => ({
    type, risk, score, description,
  }));
}

module.exports = { detectSensitiveData, getPatterns };
