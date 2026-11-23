import { EMPTY, filter, Observable, take } from "rxjs";

import type { AccessLeaseView, CipherAccessStateView } from "../abstractions/access-lease";

import { rereadAt } from "./reread-at";

/** Whether the lease's window is still open. An unparseable `notAfter` counts as lapsed, failing closed. */
export function isLeaseLive(lease: Pick<AccessLeaseView, "notAfter">, nowMs: number): boolean {
  return Date.parse(lease.notAfter) > nowMs;
}

/**
 * The active lease, or `undefined` once its window has closed, since nothing announces a lease
 * running out.
 */
export function liveActiveLease(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): AccessLeaseView | undefined {
  const lease = state?.activeLease;
  return lease != null && isLeaseLive(lease, nowMs) ? lease : undefined;
}

/** How long past a request's window a server whose clock trails this one may still report it. */
const TRAILING_SERVER_GRACE_MS = 60_000;

/** How soon to ask again while the server still reports a request whose window has closed. */
const TRAILING_SERVER_RETRY_MS = 5_000;

/**
 * When to read `state` again: at the earliest of its lease ending and its pending or approved
 * request's window closing, since nothing announces any of these. A request has no local clamp
 * like {@link liveActiveLease}, so one still reported past its window is asked about again
 * shortly, for a bounded time, in case the server's clock trails this one.
 */
export function nextRereadMs(
  state: CipherAccessStateView | null | undefined,
  nowMs: number,
): number | undefined {
  const leaseEndMs = Date.parse(state?.activeLease?.notAfter ?? "");
  const requestDueMs = [state?.pendingRequest, state?.approvedRequest]
    .map((request) => Date.parse(request?.leaseNotAfter ?? ""))
    .filter((endMs) => endMs > nowMs - TRAILING_SERVER_GRACE_MS)
    .map((endMs) => (endMs > nowMs ? endMs : nowMs + TRAILING_SERVER_RETRY_MS));
  const dueMs = [...(leaseEndMs > nowMs ? [leaseEndMs] : []), ...requestDueMs];
  return dueMs.length > 0 ? Math.min(...dueMs) : undefined;
}

/** Emits once `ticks$` reaches {@link nextRereadMs}, or never when nothing in `state` lapses. */
export function lapse$(
  state: CipherAccessStateView | null | undefined,
  ticks$: Observable<number>,
): Observable<number> {
  const lapseMs = nextRereadMs(state, Date.now());
  return lapseMs == null
    ? EMPTY
    : ticks$.pipe(
        filter((nowMs) => nowMs >= lapseMs),
        take(1),
      );
}

/**
 * `read$`'s state, read again whenever it lapses on `ticks$`: the lease may have been extended
 * without this surface hearing of it, and the server drops a request once its window closes.
 */
export function rereadOnLapse<T extends CipherAccessStateView | null | undefined>(
  read$: () => Observable<T>,
  ticks$: Observable<number>,
): Observable<T> {
  return rereadAt<T>(read$, nextRereadMs, ticks$);
}
