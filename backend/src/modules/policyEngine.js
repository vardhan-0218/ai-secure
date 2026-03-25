/**
 * Policy Engine
 * Applies mask / block / allow actions based on risk level and options.
 */

const REDACTED_PLACEHOLDER = '[REDACTED]';

const MASK_PATTERNS = [
  { regex: /(?:password|passwd|pwd|pass)\s*[:=]\s*['"]?([^\s'";&,\]]+)/gi, label: 'password' },
  { regex: /(?:secret|private_key|client_secret)\s*[:=]\s*['"]?([^\s'";&,\]]+)/gi, label: 'secret' },
  { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9\-_]{16,})/gi, label: 'api_key' },
  { regex: /\b(AKIA[0-9A-Z]{16})\b/g, label: 'aws_key' },
  { regex: /\b(sk-[A-Za-z0-9]{32,})\b/g, label: 'openai_key' },
  { regex: /\b(AIza[A-Za-z0-9_\-]{35})\b/g, label: 'gemini_key' },
  { regex: /\b(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)\b/g, label: 'jwt' },
  { regex: /Bearer\s+([A-Za-z0-9\-_.~+/]+=*)/gi, label: 'bearer' },
  { regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |OPENSSH )?PRIVATE KEY-----/gi, label: 'pem_key' },
  { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, label: 'credit_card' },
  { regex: /(?:mysql|postgresql|postgres|mongodb|redis):\/\/[^\s'"]+/gi, label: 'db_connection' },
];

/**
 * Apply security policy to content.
 * @param {string} content - Original content
 * @param {Array} findings - Detection findings
 * @param {string} riskLevel - Overall risk level
 * @param {object} options - { mask, block_high_risk }
 * @returns {{ processedContent: string, action: string, maskedCount: number }}
 */
function applyPolicy(content, findings, riskLevel, options = {}) {
  const { mask = true, block_high_risk = true } = options;

  // Block entire content for critical/high risk if block_high_risk is set
  if (block_high_risk && (riskLevel === 'critical' || riskLevel === 'high')) {
    return {
      processedContent: `[CONTENT BLOCKED — ${riskLevel.toUpperCase()} RISK DETECTED. ${findings.length} sensitive item(s) found. Original content withheld for security.]`,
      action: 'blocked',
      maskedCount: findings.length,
    };
  }

  // Mask sensitive data inline
  if (mask) {
    let processedContent = content;
    let maskedCount = 0;

    MASK_PATTERNS.forEach(({ regex, label }) => {
      const newRegex = new RegExp(regex.source, regex.flags);
      const before = processedContent;
      processedContent = processedContent.replace(newRegex, (match, p1) => {
        maskedCount++;
        // For key=value patterns, keep the key, redact the value
        if (p1 && match.includes(p1)) {
          return match.replace(p1, REDACTED_PLACEHOLDER);
        }
        return REDACTED_PLACEHOLDER;
      });
    });

    return {
      processedContent,
      action: maskedCount > 0 ? 'masked' : 'allowed',
      maskedCount,
    };
  }

  return {
    processedContent: content,
    action: 'allowed',
    maskedCount: 0,
  };
}

module.exports = { applyPolicy };
