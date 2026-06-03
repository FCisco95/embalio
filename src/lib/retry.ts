export interface RetryOpts {
  /** Number of retries AFTER the first attempt. Default 2 (so up to 3 tries). */
  retries?: number;
  /** Base delay before the first retry, in ms. Default 200. */
  baseMs?: number;
  /** Upper bound on any single delay, in ms. Default 5000. */
  maxMs?: number;
  /** Backoff multiplier applied per attempt. Default 2. */
  factor?: number;
  /** Randomize each delay to [0.5x, 1x) to avoid thundering herds. Default true. */
  jitter?: boolean;
  /** Decide whether a given error is worth retrying. Default: retry everything. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Observe each retry (logging/metrics). attempt is 1-based for the upcoming retry. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  /** Abort between attempts. If already aborted, the last error is rethrown immediately. */
  signal?: AbortSignal;
  /** Injectable delay — overridable in tests for determinism. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying on failure with exponential backoff + jitter.
 *
 * Generalizes the one-shot retry baked into `generateStructured`: bounded
 * attempts, transient-only via `shouldRetry`, and a hard delay cap so callers
 * stay inside Vercel's function ceiling. `fn` receives the 1-based attempt number.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const {
    retries = 2,
    baseMs = 200,
    maxMs = 5000,
    factor = 2,
    jitter = true,
    shouldRetry = () => true,
    onRetry,
    signal,
    sleep = defaultSleep,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    if (signal?.aborted) throw lastErr ?? signal.reason ?? new Error("aborted");
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const isLast = attempt > retries;
      if (isLast || !shouldRetry(err, attempt)) throw err;
      const backoff = Math.min(maxMs, baseMs * factor ** (attempt - 1));
      const delay = jitter ? backoff * (0.5 + Math.random() * 0.5) : backoff;
      onRetry?.(err, attempt, delay);
      await sleep(delay);
    }
  }
  // Unreachable: the loop either returns or throws.
  throw lastErr;
}
