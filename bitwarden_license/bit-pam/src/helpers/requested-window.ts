import { AccessRequestDetailsResponse } from "../abstractions/responses/access-request-details.response";

/**
 * Length of the requested access window in seconds — `leaseNotAfter − leaseNotBefore` —
 * or null when either bound is missing (an open-ended request whose duration the window does not
 * pin down).
 *
 * Replaces the former server-sent `requestedTtlSeconds`: clients derive the window length locally
 * from the bounds the server already returns rather than receiving it denormalized. For an
 * extension the bounds describe only the bump it added (prior end → new end), so the same
 * subtraction yields the added time.
 */
export function requestedWindowSeconds(
  request: Pick<AccessRequestDetailsResponse, "leaseNotBefore" | "leaseNotAfter">,
): number | null {
  if (request.leaseNotBefore == null || request.leaseNotAfter == null) {
    return null;
  }
  return (Date.parse(request.leaseNotAfter) - Date.parse(request.leaseNotBefore)) / 1000;
}
