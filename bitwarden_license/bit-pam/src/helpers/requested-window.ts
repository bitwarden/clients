import { AccessRequestDetailsResponse } from "../abstractions/responses/access-request-details.response";

/**
 * Length of the requested access window in seconds — `requestedNotAfter − requestedNotBefore` —
 * or null when either bound is missing (an open-ended request whose duration the window does not
 * pin down).
 *
 * Replaces the former server-sent `requestedTtlSeconds`: clients derive the window length locally
 * from the bounds the server already returns rather than receiving it denormalized. For an
 * extension the bounds describe only the bump it added (prior end → new end), so the same
 * subtraction yields the added time.
 */
export function requestedWindowSeconds(
  request: Pick<AccessRequestDetailsResponse, "requestedNotBefore" | "requestedNotAfter">,
): number | null {
  if (request.requestedNotBefore == null || request.requestedNotAfter == null) {
    return null;
  }
  return (Date.parse(request.requestedNotAfter) - Date.parse(request.requestedNotBefore)) / 1000;
}
