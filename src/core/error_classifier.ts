// API Error Classification & Failover Strategy Engine for J.A.R.V.I.S.
// Classifies model and tool errors to select the optimal recovery path:
// retry, rotate credentials, fall back to another model/provider, compress context, or abort.
// Ported and enhanced from Hermes (agent/error_classifier.py)

export enum FailoverReason {
  AUTH = 'auth',                         // 401/403: Transient auth issue -> rotate/refresh
  AUTH_PERMANENT = 'auth_permanent',     // Auth failed permanently -> abort
  BILLING = 'billing',                   // 402 / credit exhaustion -> switch provider
  RATE_LIMIT = 'rate_limit',             // 429 -> exponential backoff with jitter
  UPSTREAM_RATE_LIMIT = 'upstream_rate_limit', // Upstream aggregator rate limit -> fallback model
  OVERLOADED = 'overloaded',             // 503/529 -> provider overloaded, backoff
  SERVER_ERROR = 'server_error',         // 500/502 -> internal error, retry
  TIMEOUT = 'timeout',                   // Network timeout -> retry with fresh client
  CONTEXT_LENGTH = 'context_length',     // Prompt exceeds context window -> trigger compression
  CONTENT_FILTER = 'content_filter',     // Safety refusal / policy block -> sanitize and simplify
  MALFORMED_OUTPUT = 'malformed_output', // Bad tool call / broken JSON -> repair and re-prompt
  UNKNOWN = 'unknown'
}

export interface ClassifiedError {
  reason: FailoverReason;
  statusCode?: number;
  message: string;
  isRetryable: boolean;
  requiresFallback: boolean;
  requiresCompression: boolean;
  retryAfterSeconds?: number;
}

export function classifyApiError(err: any): ClassifiedError {
  const status = err?.status || err?.statusCode || err?.response?.status;
  const rawMsg = String(err?.message || err?.error?.message || err || '').toLowerCase();

  // 1. Context length exhaustion
  if (
    rawMsg.includes('context length') ||
    rawMsg.includes('maximum context') ||
    rawMsg.includes('token limit') ||
    rawMsg.includes('prompt is too long') ||
    rawMsg.includes('exceeds the context window') ||
    status === 413
  ) {
    return {
      reason: FailoverReason.CONTEXT_LENGTH,
      statusCode: status || 413,
      message: 'Context window limit exceeded. Compression required.',
      isRetryable: true,
      requiresFallback: false,
      requiresCompression: true
    };
  }

  // 2. Billing / Credit exhaustion
  if (
    status === 402 ||
    rawMsg.includes('insufficient_quota') ||
    rawMsg.includes('credit balance') ||
    rawMsg.includes('billing') ||
    rawMsg.includes('out of credits') ||
    rawMsg.includes('payment required')
  ) {
    return {
      reason: FailoverReason.BILLING,
      statusCode: status || 402,
      message: 'API credits or quota exhausted.',
      isRetryable: false,
      requiresFallback: true,
      requiresCompression: false
    };
  }

  // 3. Rate limiting (429)
  if (status === 429 || rawMsg.includes('rate limit') || rawMsg.includes('too many requests')) {
    let retryAfter = 5;
    if (err?.headers?.['retry-after']) {
      const parsed = parseFloat(err.headers['retry-after']);
      if (!isNaN(parsed) && parsed > 0) retryAfter = parsed;
    }
    return {
      reason: FailoverReason.RATE_LIMIT,
      statusCode: 429,
      message: 'Rate limit encountered.',
      isRetryable: true,
      requiresFallback: false,
      requiresCompression: false,
      retryAfterSeconds: retryAfter
    };
  }

  // 4. Overloaded servers (503, 529)
  if (status === 503 || status === 529 || rawMsg.includes('overloaded') || rawMsg.includes('capacity')) {
    return {
      reason: FailoverReason.OVERLOADED,
      statusCode: status || 503,
      message: 'AI Provider service overloaded.',
      isRetryable: true,
      requiresFallback: false,
      requiresCompression: false,
      retryAfterSeconds: 3
    };
  }

  // 5. Auth / Permissions
  if (status === 401 || status === 403 || rawMsg.includes('unauthorized') || rawMsg.includes('invalid api key')) {
    return {
      reason: FailoverReason.AUTH,
      statusCode: status || 401,
      message: 'Authentication failure or invalid API key.',
      isRetryable: false,
      requiresFallback: true,
      requiresCompression: false
    };
  }

  // 6. Content filter / Safety block
  if (rawMsg.includes('content policy') || rawMsg.includes('safety') || rawMsg.includes('blocked by filter')) {
    return {
      reason: FailoverReason.CONTENT_FILTER,
      statusCode: status,
      message: 'Request flagged by provider content policy.',
      isRetryable: false,
      requiresFallback: true,
      requiresCompression: false
    };
  }

  // 7. Malformed output / Broken JSON in tool call
  if (rawMsg.includes('json') && (rawMsg.includes('syntax') || rawMsg.includes('parse') || rawMsg.includes('unexpected token'))) {
    return {
      reason: FailoverReason.MALFORMED_OUTPUT,
      statusCode: status,
      message: 'Malformed JSON or function arguments produced by model.',
      isRetryable: true,
      requiresFallback: false,
      requiresCompression: false
    };
  }

  // 8. Default generic error
  return {
    reason: FailoverReason.UNKNOWN,
    statusCode: status,
    message: rawMsg || 'Unknown API error',
    isRetryable: status >= 500 && status < 600,
    requiresFallback: false,
    requiresCompression: false
  };
}
