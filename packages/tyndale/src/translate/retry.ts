// packages/tyndale/src/translate/retry.ts

export interface RetryOptions {
  /** Maximum number of attempts (default: 3). */
  maxAttempts?: number;
  /** Base delay in ms before first retry (doubled each subsequent retry). Default: 1000. */
  baseDelayMs?: number;
  /** Called before each retry with the upcoming attempt number and the error that triggered it. */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Executes an async function with exponential backoff retry.
 *
 * Delay schedule: baseDelayMs, baseDelayMs*2, baseDelayMs*4, ...
 * Throws the last error after all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, onRetry } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        onRetry?.(attempt + 1, lastError);
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError!;
}
