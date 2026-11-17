import { MonoTypeOperatorFunction, Observable, catchError, retry, throwError, timer } from "rxjs";

import type { LogService } from "@bitwarden/logging";

/**
 * Reports one retried failure: the human-readable message and the triggering error, mirroring a
 * `logService.warning(message, error)` call. The caller owns the severity — pass a function to log
 * (or surface) however you like. See {@link retryWithBackoff}.
 */
export type RetryReport = (message: string, error: unknown) => void;

export interface RetryWithBackoffOptions {
  /**
   * Consecutive failures to tolerate before giving up. Omit (the default) to retry **forever**,
   * reporting every attempt and never erroring. When set, after this many reported retries the
   * source is still failing the operator stops and errors (see {@link retryWithBackoff}). A
   * successful emission resets the count, so this bounds *consecutive* failures, not the lifetime
   * total.
   */
  maxRetries?: number;
  /** Backoff before the first retry, in milliseconds. Grows by {@link scale} each retry. Default `250`. */
  initialDelayMs?: number;
  /** Upper bound on the backoff, in milliseconds. Default `30_000`. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each consecutive failure. Default `2`. */
  scale?: number;
}

/**
 * Retries a failing source with exponential backoff, reporting each retried failure. By default it
 * retries **forever**, which suits long-lived streams where a transient error should self-heal.
 * Set `maxRetries` to bound it and turn a sustained failure into a terminal error instead.
 *
 * Behavior a caller can rely on:
 * - Each consecutive failure is passed to `report` (message + triggering error), then the source is
 *   resubscribed after a backoff that grows geometrically from `initialDelayMs`
 *   (`initialDelayMs * scale ** (retryCount - 1)`), capped at `maxDelayMs`.
 * - A successful emission resets the retry count, so `maxRetries` bounds *consecutive* failures.
 * - With the default unbounded `maxRetries`, the stream never errors — it reports and retries
 *   indefinitely.
 * - When a finite `maxRetries` is exhausted the operator **errors**. The error that exhausted the
 *   budget is attached as the thrown error's `cause`.
 *
 * As a convenience, `report` may be a {@link LogService} instead of a function, in which case its
 * `warning` method is used.
 *
 * @param report - How to surface each retried failure, or a `LogService` (its `warning` is used).
 * @param label - Identifies the stream in the reported message and the give-up error.
 * @param options - Retry threshold and backoff tuning; see {@link RetryWithBackoffOptions}.
 */
export function retryWithBackoff<T>(
  report: RetryReport | LogService,
  label: string,
  options: RetryWithBackoffOptions = {},
): MonoTypeOperatorFunction<T> {
  const { maxRetries = Infinity, initialDelayMs = 250, maxDelayMs = 30_000, scale = 2 } = options;

  const reportFailure: RetryReport =
    typeof report === "function" ? report : (message, error) => report.warning(message, error);

  return (source: Observable<T>) =>
    source.pipe(
      retry({
        count: maxRetries,
        resetOnSuccess: true,
        delay: (error, retryCount) => {
          const wait = Math.min(initialDelayMs * scale ** (retryCount - 1), maxDelayMs);
          // Omit the "/N" denominator when unbounded — there is no threshold to count toward.
          const attempt = Number.isFinite(maxRetries)
            ? `retry ${retryCount}/${maxRetries}`
            : `retry ${retryCount}`;
          reportFailure(`[${label}] stream error (${attempt}); retrying in ${wait}ms`, error);
          return timer(wait);
        },
      }),
      // Retries are exhausted. The earlier failures went to `report`; fail with a fresh error naming
      // the give-up, keeping the final triggering error as its `cause` rather than re-surfacing it.
      // `cause` is set manually because the TS lib target predates the Error `cause` constructor option.
      catchError((error: unknown) => {
        const giveUp: Error & { cause?: unknown } = new Error(
          `[${label}] gave up after ${maxRetries} retries`,
        );
        giveUp.cause = error;
        return throwError(() => giveUp);
      }),
    );
}
