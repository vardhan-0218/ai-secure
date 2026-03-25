/**
 * Root Cause Engine
 * Maps every finding type → why it occurred + how to fix it.
 */

const ROOT_CAUSE_MAP = {
  password: {
    rootCause: 'Hardcoded password found in source code or log output. This typically occurs when developers embed credentials directly into application code, configuration files, or leave debug logging enabled in production that exposes config values.',
    fixSuggestions: [
      'Move all passwords to environment variables (e.g., process.env.DB_PASSWORD)',
      'Use a secrets manager such as AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault',
      'Disable verbose/debug logging in production environments',
      'Audit all configuration files and remove hardcoded values before committing to version control',
      'Add a pre-commit hook (e.g., git-secrets or truffleHog) to prevent credential commits',
    ],
  },
  secret: {
    rootCause: 'Application secret or private key exposed in plaintext. Often caused by misconfigured logging, improper secret rotation, or developers leaving test credentials in production code.',
    fixSuggestions: [
      'Rotate the exposed secret immediately — assume it is compromised',
      'Store secrets in environment variables or a dedicated secrets manager',
      'Add .env files to .gitignore to prevent accidental commits',
      'Implement secret scanning in CI/CD pipelines',
      'Use short-lived secrets and enforce automatic rotation policies',
    ],
  },
  api_key: {
    rootCause: 'API key exposed in logs, source code, or request/response payloads. Common cause: developers using API keys in client-side code, logging HTTP headers, or hardcoding keys in configuration files for convenience.',
    fixSuggestions: [
      'Revoke and regenerate the exposed API key immediately',
      'Store API keys in environment variables, never in source code',
      'Restrict API key permissions to minimum required scopes',
      'Use IP allowlisting on API keys where supported',
      'Implement API key rotation on a regular schedule',
    ],
  },
  aws_key: {
    rootCause: 'AWS Access Key ID detected. This is a critical security incident — AWS keys grant cloud infrastructure access. Common causes: keys committed to source repositories, embedded in Lambda environment variable exports, or logged in CloudWatch.',
    fixSuggestions: [
      'Immediately deactivate the exposed key in AWS IAM Console',
      'Audit CloudTrail logs for unauthorized access using this key',
      'Use IAM roles instead of long-lived access keys for EC2/Lambda',
      'Enable AWS Config rules to detect exposed credentials',
      'Use AWS Secrets Manager or SSM Parameter Store for credential management',
    ],
  },
  openai_key: {
    rootCause: 'OpenAI/service API key (sk-...) exposed. Typically leaked via frontend JavaScript bundles, server-side logging of request headers, or hardcoded in configuration files. Exposure leads to unauthorized API usage and billing abuse.',
    fixSuggestions: [
      'Revoke the key immediately at platform.openai.com',
      'Never expose API keys in frontend/client-side code — proxy all AI calls through your backend',
      'Implement rate limiting and usage monitoring on API keys',
      'Use scoped keys with minimal permissions where available',
    ],
  },
  gemini_key: {
    rootCause: 'Google/Gemini API key (AIza...) exposed in plaintext. Gemini keys grant access to Google AI and other Google Cloud services. Exposure can lead to unauthorized usage and significant cloud billing charges.',
    fixSuggestions: [
      'Revoke the key immediately in Google Cloud Console under "Credentials"',
      'Restrict key usage to specific APIs, IP addresses, and referrer domains',
      'Never embed API keys in client-side JavaScript — use a backend proxy',
      'Enable Google Cloud audit logging to detect unauthorized usage',
    ],
  },
  jwt_token: {
    rootCause: 'JWT (JSON Web Token) found in log output or request data. JWTs are authentication tokens that grant user-level access. Exposure in logs is caused by applications logging full request/response objects without sanitizing authorization headers.',
    fixSuggestions: [
      'Invalidate/blacklist the exposed token immediately',
      'Configure logging middleware to redact Authorization headers',
      'Use short JWT expiration times (15 minutes for access tokens)',
      'Implement token revocation via a blocklist in Redis or the database',
      'Never log raw HTTP request headers in production',
    ],
  },
  bearer_token: {
    rootCause: 'Bearer authentication token exposed. This usually occurs when HTTP request/response logging captures the Authorization header verbatim, often in debugging sessions inadvertently left active in production.',
    fixSuggestions: [
      'Revoke the token by logging out the associated session',
      'Mask Authorization headers in all logging middleware',
      'Implement automatic token expiry',
      'Use HTTPS exclusively to prevent token interception in transit',
    ],
  },
  private_key_block: {
    rootCause: 'PEM-format private key (RSA/EC/SSH) found in content. This is an extremely critical exposure. Private keys are typically leaked when developers accidentally commit key files, include them in Docker images, or log configuration that reads key files.',
    fixSuggestions: [
      'Immediately generate a new key pair and revoke/rotate the exposed key',
      'Remove the key file from version control history using git filter-branch or BFG Repo Cleaner',
      'Add *.pem, *.key, id_rsa to .gitignore permanently',
      'Store private keys in a secrets manager or hardware security module (HSM)',
      'Audit all systems that used this key for signs of unauthorized access',
    ],
  },
  email: {
    rootCause: 'Email address detected in content. While not immediately critical, exposing user email addresses in logs, APIs, or public-facing outputs violates privacy regulations (GDPR, CCPA) and can enable phishing attacks.',
    fixSuggestions: [
      'Mask or hash email addresses in log outputs (e.g., log user IDs instead)',
      'Review data minimization policies for logs and API responses',
      'Ensure access to user PII in logs is restricted to authorized personnel',
      'Implement log retention policies to limit PII exposure window',
    ],
  },
  phone: {
    rootCause: 'Phone number found in content. Exposing phone numbers can facilitate SMS phishing (smishing) attacks and violates privacy regulations. Often caused by logging full user profile objects.',
    fixSuggestions: [
      'Mask phone numbers in logs (show only last 4 digits)',
      'Avoid logging complete user profile objects — log only necessary identifiers',
      'Apply data masking at the logging framework level',
      'Review compliance requirements (GDPR, HIPAA) for PII handling',
    ],
  },
  ssn: {
    rootCause: 'Social Security Number (SSN) detected — a critical PII violation. SSNs in logs or code indicate severe data handling failures, regulatory non-compliance, and identity theft risk.',
    fixSuggestions: [
      'Immediately purge the SSN from all logs, databases, and backups where exposed',
      'Notify affected individuals and relevant regulatory authorities',
      'Encrypt all SSN fields at rest using AES-256',
      'Never log SSNs — use tokenization (store a reference ID, not the actual SSN)',
      'Implement strict access controls and audit trails for SSN access',
    ],
  },
  credit_card: {
    rootCause: 'Credit card number detected — a PCI-DSS critical violation. Credit card numbers must never appear in logs, databases in plaintext, or application code. This indicates a fundamental payment data handling failure.',
    fixSuggestions: [
      'Immediately report the exposure per PCI-DSS incident response requirements',
      'Use a PCI-compliant payment processor (Stripe, Braintree) — never handle raw card data',
      'Tokenize all payment data — store tokens, not card numbers',
      'Enable PCI-DSS compliant logging that automatically strips card data',
      'Conduct a PCI-DSS audit to assess full scope of exposure',
    ],
  },
  db_connection_string: {
    rootCause: 'Database connection string with embedded credentials found. This exposes the database hostname, username, and password simultaneously. Typically caused by logging ORM initialization, embedding connection strings in code, or misconfigured error reporting.',
    fixSuggestions: [
      'Rotate database credentials immediately',
      'Use environment variables for all connection parameters, never hardcode',
      'Implement database access via connection poolers that abstract credentials',
      'Restrict database access by IP allowlist at the network/firewall level',
      'Use IAM-based database authentication where available (AWS RDS IAM)',
    ],
  },
  ip_address: {
    rootCause: 'Internal or client IP address logged. While low risk in isolation, IP addresses combined with other data can identify users and may violate privacy regulations in some jurisdictions.',
    fixSuggestions: [
      'Consider anonymizing IP addresses in logs (mask last octet)',
      'Review log retention policies for IP-containing records',
      'Ensure IP logs are access-controlled',
    ],
  },
  brute_force: {
    rootCause: 'Brute force attack detected via repeated authentication failures. This indicates either a targeted attack against a specific account or an automated credential stuffing campaign using leaked username/password lists.',
    fixSuggestions: [
      'Implement account lockout after 5–10 failed attempts',
      'Enable CAPTCHA or MFA on login forms',
      'Block the offending IP address at the firewall or WAF level',
      'Implement progressive delays between login attempts (exponential backoff)',
      'Enable alerts for repeated auth failures in your SIEM',
      'Consider deploying a Web Application Firewall (WAF)',
    ],
  },
  stack_trace: {
    rootCause: 'Application stack trace exposed in logs or HTTP responses. Stack traces reveal internal application structure, framework versions, file paths, and line numbers — valuable reconnaissance data for attackers.',
    fixSuggestions: [
      'Set NODE_ENV=production to suppress detailed error output',
      'Use a global error handler that returns generic "Internal Server Error" to clients',
      'Log full traces server-side only — never send to clients in production',
      'Review all error handlers to ensure they strip internal details from responses',
    ],
  },
  error_leak: {
    rootCause: 'Server error details leaked publicly. HTTP 500 errors with detailed messages expose internal application state and can reveal technology stack, database errors, or business logic details to potential attackers.',
    fixSuggestions: [
      'Implement proper error handling middleware that returns sanitized error messages',
      'Log detailed errors server-side with correlation IDs only',
      'Return RFC 7807 ProblemDetails responses with minimal info in production',
      'Monitor error rates and set up alerts for spikes in 5xx responses',
    ],
  },
  sql_injection_attempt: {
    rootCause: 'SQL injection pattern detected in input. Attackers embed SQL commands in user input fields, URLs, or request parameters hoping the application will execute them against the database without proper sanitization.',
    fixSuggestions: [
      'Use parameterized queries or prepared statements exclusively — never string concatenation',
      'Implement an ORM (Sequelize, Prisma, SQLAlchemy) with built-in SQL injection protection',
      'Deploy a Web Application Firewall (WAF) with SQL injection rules',
      'Validate and sanitize all user inputs server-side',
      'Apply principle of least privilege on database accounts',
    ],
  },
  path_traversal: {
    rootCause: 'Path traversal attack detected (../../etc/passwd). Attackers use ../ sequences in file path inputs to escape the intended directory and access sensitive system files like /etc/passwd, /etc/shadow, or application config files.',
    fixSuggestions: [
      'Validate and normalize all file paths before use — use path.resolve() and check it starts with expected base dir',
      'Never directly use user input as file paths',
      'Chroot/jail the application to limit filesystem access',
      'Implement strict allowlisting for allowed file operations',
    ],
  },
  xss_attempt: {
    rootCause: 'Cross-Site Scripting (XSS) attempt detected. Attackers inject malicious JavaScript via user input hoping it will be reflected or stored and executed in other users\' browsers, enabling session hijacking or data theft.',
    fixSuggestions: [
      'Implement Content Security Policy (CSP) headers',
      'Escape all user-generated output using a context-aware escaping library',
      'Use frameworks that auto-escape output (React, Vue already do this)',
      'Sanitize HTML input with DOMPurify if rich text is required',
      'Set HttpOnly and Secure flags on all session cookies',
    ],
  },
  sensitive_file_access: {
    rootCause: 'Attempt to access sensitive system files detected (/etc/passwd, .env, id_rsa). This indicates directory traversal or file inclusion attacks targeting authentication databases, environment configs, or SSH keys.',
    fixSuggestions: [
      'Implement strict file path validation and allowlisting',
      'Configure web server to deny access to sensitive files (.env, *.pem, etc.)',
      'Review application file handling logic for path injection vulnerabilities',
      'Apply principle of least privilege on file system permissions',
    ],
  },
  hardcoded_credential: {
    rootCause: 'Credential embedded directly in code or log output. This is a development anti-pattern where time pressure leads developers to hardcode values that should be externalized, or debug logging inadvertently captures authentication configuration.',
    fixSuggestions: [
      'External all credentials to environment variables immediately',
      'Rotate all exposed credentials assuming they are compromised',
      'Use a code scanner (Semgrep, CodeQL) to detect hardcoded secrets in CI/CD',
      'Set up pre-commit hooks to scan for secrets before code is pushed',
    ],
  },
  login_failure: {
    rootCause: 'Authentication failure logged. Individual failures are normal but patterns indicate either users forgetting passwords, account sharing, or the beginning of a credential-based attack.',
    fixSuggestions: [
      'Monitor for patterns: 3+ failures in 5 minutes from same IP',
      'Implement exponential backoff for repeated failures',
      'Send account owner an alert email after 5 consecutive failures',
      'Consider MFA enforcement for accounts with repeated failures',
    ],
  },
};

/**
 * Enrich findings with root cause and fix suggestions.
 * @param {Array} findings
 * @returns {Array} enriched findings
 */
function enrichFindingsWithRootCause(findings) {
  return findings.map((finding) => {
    const info = ROOT_CAUSE_MAP[finding.type] || {
      rootCause: `${finding.type} detected. This indicates potentially sensitive or risky content in the analyzed data.`,
      fixSuggestions: [
        'Review the detected content and assess whether it should be present',
        'Follow the principle of least privilege when handling sensitive data',
        'Consult your security team for type-specific remediation guidance',
      ],
    };
    return { ...finding, rootCause: info.rootCause, fixSuggestions: info.fixSuggestions };
  });
}

module.exports = { enrichFindingsWithRootCause, ROOT_CAUSE_MAP };
