import type { AccessRequestView } from "../abstractions/access-lease";

/**
 * Length of the requested access window in seconds — `leaseNotAfter − leaseNotBefore`. For an
 * extension, the bounds describe only the added bump, so the same subtraction yields the added
 * time.
 *
 * Both bounds are non-optional on {@link AccessRequestView}, since the server always resolves
 * the activation window at submit, so this never needs an open-ended fallback.
 */
export function requestedWindowSeconds(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
): number {
  return (Date.parse(request.leaseNotAfter) - Date.parse(request.leaseNotBefore)) / 1000;
}
