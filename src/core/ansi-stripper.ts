// Strip ANSI escape codes from terminal output
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

export function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

export function cleanForContext(text: string): string {
  return collapseBlankLines(stripAnsi(text)).trim();
}

/**
 * Redact common secret patterns from text before sending to LLM.
 * Catches: API keys, tokens, passwords in env vars, AWS keys, etc.
 */
export function redactSecrets(text: string): string {
  return text
    // API keys / tokens (long alphanumeric strings after = or :)
    .replace(/((?:key|token|secret|password|apikey|api_key|auth|credential|access_key|secret_key)\s*[=:]\s*)[^\s'",;}{)\]]+/gi, '$1[REDACTED]')
    // AWS access keys (AKIA...)
    .replace(/AKIA[A-Z0-9]{16}/g, '[REDACTED_AWS_KEY]')
    // Bearer tokens
    .replace(/(Bearer\s+)[^\s'",;]+/gi, '$1[REDACTED]')
    // JWT tokens
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]')
    // Generic long hex/base64 strings (likely secrets, 32+ chars)
    .replace(/(?<=[=:\s])[A-Za-z0-9+/]{40,}={0,2}(?=[\s\n'",;]|$)/g, '[REDACTED]');
}
