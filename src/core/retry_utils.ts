// Jittered Backoff & Adaptive Retry Utilities for J.A.R.V.I.S.
// Prevents thundering-herd spikes and adapts wait windows based on provider throttling.
// Ported and enhanced from Hermes (agent/retry_utils.py)

import { logSecurity } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  onRetry?: (attempt: number, delayMs: number, err: any) => void;
}

export function computeJitteredDelay(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000,
  jitterFactor: number = 0.3
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  const jitterRange = capped * jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(100, Math.floor(capped + jitter));
}

export async function withAdaptiveRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 20000;
  const jitterFactor = options.jitterFactor ?? 0.25;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt === maxRetries) {
        break;
      }

      const delay = computeJitteredDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor);
      if (options.onRetry) {
        options.onRetry(attempt + 1, delay, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
