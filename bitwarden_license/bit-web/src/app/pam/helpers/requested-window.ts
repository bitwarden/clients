import type { AccessRequestView } from "../abstractions/access-lease";

/**
 * Length of the requested access window in seconds — `leaseNotAfter − leaseNotBefore`. For an
 * extension request the bounds describe only the bump it added (prior lease end → new end), so
 * the same subtraction yields the added time.
 *
 * Unlike the poc's version, both bounds are non-optional on {@link AccessRequestView} (the server
 * always resolves the activation window at submit), so this never needs an open-ended fallback.
 */
export function requestedWindowSeconds(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
): number {
  return (Date.parse(request.leaseNotAfter) - Date.parse(request.leaseNotBefore)) / 1000;
}
