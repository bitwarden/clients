import { mock } from "jest-mock-extended";
import { concat, defer, of, throwError } from "rxjs";

import type { LogService } from "@bitwarden/logging";

import { retryWithBackoff } from "./retry-with-backoff";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // A cold source that throws a fresh Error its first `failures` subscriptions, then emits `value`
  // and completes. Each resubscribe advances the attempt counter.
  const flakySource = (failures: number, value: unknown = "ok") => {
    let attempts = 0;
    return defer(() => {
      attempts += 1;
      return attempts <= failures ? throwError(() => new Error(`fail ${attempts}`)) : of(value);
    });
  };

  // Every other test supplies `initialDelayMs`, and all but one supply `scale`, which leaves both
  // documented defaults free to drift. This is the only case that exercises the geometric formula
  // on the defaults alone, so the two delays are written out rather than derived.
  it("defaults to a 250ms first backoff, doubling thereafter", () => {
    const report = jest.fn();

    flakySource(2).pipe(retryWithBackoff(report, "defaults")).subscribe();

    expect(report).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("retrying in 250ms"),
      expect.any(Error),
    );

    jest.advanceTimersByTime(250);
    expect(report).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("retrying in 500ms"),
      expect.any(Error),
    );
  });

  it("retries with exponential backoff and recovers, reporting each failure with its error", () => {
    const report = jest.fn();
    const emissions: unknown[] = [];
    let completed = false;

    flakySource(2)
      .pipe(retryWithBackoff(report, "test", { initialDelayMs: 100, scale: 2 }))
      .subscribe({ next: (v) => emissions.push(v), complete: () => (completed = true) });

    // First failure is synchronous on subscribe; a 100ms backoff is scheduled, nothing emitted yet.
    // The message carries the label and the concrete delay, and the triggering error is passed along.
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("[test] stream error (retry 1); retrying in 100ms"),
      expect.any(Error),
    );
    expect((report.mock.calls[0][1] as Error).message).toBe("fail 1");
    expect(emissions).toEqual([]);

    jest.advanceTimersByTime(100); // second attempt fails, schedules a 200ms backoff (100 * 2)
    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("retry 2); retrying in 200ms"),
      expect.any(Error),
    );

    jest.advanceTimersByTime(200); // third attempt succeeds
    expect(emissions).toEqual(["ok"]);
    expect(completed).toBe(true);
  });

  it("caps the backoff at maxDelayMs", () => {
    const report = jest.fn();

    const sub = flakySource(Infinity)
      .pipe(retryWithBackoff(report, "cap", { initialDelayMs: 100, scale: 10, maxDelayMs: 150 }))
      .subscribe({ error: (_error: unknown) => undefined });

    // retry 1: 100 * 10^0 = 100ms (under the cap)
    expect(report).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("retrying in 100ms"),
      expect.any(Error),
    );

    jest.advanceTimersByTime(100);
    // retry 2: 100 * 10^1 = 1000ms, clamped to the 150ms cap
    expect(report).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("retrying in 150ms"),
      expect.any(Error),
    );

    sub.unsubscribe();
  });

  it("retries forever by default, complaining on every attempt without erroring", () => {
    const report = jest.fn();
    let errored = false;

    const sub = flakySource(Infinity)
      .pipe(retryWithBackoff(report, "forever", { initialDelayMs: 10, maxDelayMs: 10 }))
      .subscribe({ error: (_error: unknown) => (errored = true) });

    jest.advanceTimersByTime(1000); // ~100 retries at the 10ms cap

    expect(errored).toBe(false);
    expect(report.mock.calls.length).toBeGreaterThan(10);
    // Unbounded: the retry message carries no "/N" denominator.
    const lastMessage = report.mock.calls[report.mock.calls.length - 1][0] as string;
    expect(lastMessage).toContain("stream error (retry");
    expect(lastMessage).not.toContain("/");

    sub.unsubscribe();
  });

  it("gives up after maxRetries and errors with a fresh give-up error, not the triggering one", () => {
    const report = jest.fn();
    let caught: unknown;

    flakySource(Infinity) // never recovers
      .pipe(retryWithBackoff(report, "test", { maxRetries: 3, initialDelayMs: 10 }))
      .subscribe({ error: (error: unknown) => (caught = error) });

    jest.advanceTimersByTime(10_000); // drive every backoff

    expect(report).toHaveBeenCalledTimes(3); // one per retry, retries 1..3
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("[test] gave up after 3 retries");
    // The triggering "fail N" errors were handed to `report`, not re-surfaced in the give-up message.
    expect((caught as Error).message).not.toContain("fail");
    // ...but the decisive failure (the one that exhausted the budget) is preserved as the cause.
    const cause = (caught as Error & { cause?: unknown }).cause;
    expect(cause).toBeInstanceOf(Error);
    expect((cause as Error).message).toBe("fail 4");
  });

  it("does not count failures that follow a success toward the give-up threshold", () => {
    const report = jest.fn();
    const emissions: unknown[] = [];
    let errored = false;

    // Each subscription emits once, then errors: resetOnSuccess keeps the count from accumulating,
    // so despite far more than maxRetries total failures the stream never gives up.
    const sub = concat(
      of("beat"),
      defer(() => throwError(() => new Error("blip"))),
    )
      .pipe(retryWithBackoff(report, "hb", { maxRetries: 2, initialDelayMs: 10 }))
      .subscribe({ next: (v) => emissions.push(v), error: (_error: unknown) => (errored = true) });

    jest.advanceTimersByTime(1000);

    expect(report.mock.calls.length).toBeGreaterThan(2);
    expect(errored).toBe(false);
    expect(emissions.length).toBeGreaterThan(2);
    // The count resets, so every report is the first retry of a fresh run.
    expect(report).toHaveBeenLastCalledWith(
      expect.stringContaining("retry 1/2"),
      expect.any(Error),
    );

    sub.unsubscribe();
  });

  it("uses LogService.warning when given a LogService instead of a function", () => {
    const logService = mock<LogService>();

    flakySource(1)
      .pipe(retryWithBackoff(logService, "svc", { initialDelayMs: 5 }))
      .subscribe();

    expect(logService.warning).toHaveBeenCalledTimes(1);
    expect(logService.warning).toHaveBeenCalledWith(
      expect.stringContaining("[svc] stream error (retry 1)"),
      expect.any(Error),
    );

    jest.advanceTimersByTime(5); // let it recover so no timer leaks
  });
});
