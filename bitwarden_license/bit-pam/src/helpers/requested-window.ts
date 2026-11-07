import type { AccessRequestView } from "../abstractions/access-lease";

/** For an extension request the bounds cover only the added time, so this yields that length. */
export function requestedWindowSeconds(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
): number {
  return (Date.parse(request.leaseNotAfter) - Date.parse(request.leaseNotBefore)) / 1000;
}
