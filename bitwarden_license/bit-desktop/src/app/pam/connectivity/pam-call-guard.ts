import {
  apiErrorBodyMessage,
  isPamUnreachableError,
  PamUnreachableError,
} from "@bitwarden/bit-pam";

import { PamCallOutcomeReporter } from "./desktop-pam-connectivity.service";

/**
 * The longest any PAM call may stay pending. Past it the call is reported as unreachable, so no
 * button spins forever; the request itself is not cancelled, and is never retried.
 */
export const PAM_CALL_TIMEOUT_MS = 20_000;

/**
 * How a failed PAM call is read:
 *
 * - `network`: no answer from the server (transport failure, gateway unavailable, or the browser
 *   reports no network); shown as the connectivity failure.
 * - `server`: the server answered with a refusal; it keeps its own message and proves the server
 *   reachable.
 * - `other`: a local failure (no active user, SDK not ready); neither.
 */
export type PamFailureClass = "network" | "server" | "other";

/**
 * Transport failures as the SDK's HTTP client and Chromium word them. Matched only when no HTTP
 * status came back, since a status means the server answered.
 */
const TRANSPORT_FAILURE_PATTERNS: readonly RegExp[] = [
  /error sending request/i,
  /failed to fetch/i,
  /networkerror/i,
  /network error/i,
  /network request failed/i,
  /net::err_/i,
  /err_internet_disconnected/i,
  /err_network_changed/i,
  /err_connection_/i,
  /err_name_not_resolved/i,
  /err_address_unreachable/i,
  /connection (refused|reset|closed)/i,
  /dns error/i,
  /(request|operation) timed out/i,
];

/** A gateway answering for a server it cannot reach: the server itself never answered. */
const GATEWAY_UNAVAILABLE_STATUS = /\[(502|503|504)\]/;

/** Any other HTTP status the SDK appends, e.g. `[400]` or `[404]`: the server answered. */
const HTTP_STATUS = /\[\d{3}\]/;

export function classifyPamFailure(e: unknown): PamFailureClass {
  if (isPamUnreachableError(e)) {
    return "network";
  }
  const message = errorMessage(e);
  if (GATEWAY_UNAVAILABLE_STATUS.test(message)) {
    return "network";
  }
  if (HTTP_STATUS.test(message) || apiErrorBodyMessage(message) != null) {
    return "server";
  }
  return TRANSPORT_FAILURE_PATTERNS.some((pattern) => pattern.test(message)) ? "network" : "other";
}

/**
 * Wraps every promise-returning method of a PAM SDK service so that it:
 *
 * - settles within `timeoutMs`, rejecting with a `PamUnreachableError("timeout")` past it;
 * - rejects with a `PamUnreachableError("network")` for a network-class failure, keeping the SDK's
 *   error on it, and rethrows a server refusal or local failure unchanged;
 * - reports each outcome to `reporter`, so connectivity follows the calls actually made.
 *
 * It never retries and never queues: a failed call is simply failed.
 */
export function guardPamCalls<T extends object>(
  service: T,
  reporter: PamCallOutcomeReporter,
  timeoutMs: number = PAM_CALL_TIMEOUT_MS,
): T {
  const wrapped = new Map<PropertyKey, unknown>();
  return new Proxy(service, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }
      let guarded = wrapped.get(property);
      if (guarded == null) {
        guarded = (...args: unknown[]): unknown => {
          const result: unknown = value.apply(target, args);
          return isPromiseLike(result) ? guardCall(result, reporter, timeoutMs) : result;
        };
        wrapped.set(property, guarded);
      }
      return guarded;
    },
  });
}

function guardCall<R>(
  call: PromiseLike<R>,
  reporter: PamCallOutcomeReporter,
  timeoutMs: number,
): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reporter.reportUnreachable();
      reject(new PamUnreachableError("timeout"));
    }, timeoutMs);

    call.then(
      (value) => {
        // A late answer still proves the server reachable, though its caller has moved on.
        reporter.reportReachable();
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        const failure = reporter.browserOffline ? "network" : classifyPamFailure(error);
        if (failure === "network") {
          reporter.reportUnreachable();
        } else if (failure === "server") {
          reporter.reportReachable();
        }
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(
          failure === "network" && !isPamUnreachableError(error)
            ? new PamUnreachableError("network", error)
            : error,
        );
      },
    );
  });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  if (typeof e === "string") {
    return e;
  }
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
}
