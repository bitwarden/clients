// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { parse } from "tldts";

export function isValidRpId(rpId: string, origin: string) {
  if (!rpId || !origin) {
    return false;
  }

  const parsedOrigin = parse(origin, { allowPrivateDomains: true });
  const parsedRpId = parse(rpId, { allowPrivateDomains: true });

  if (!parsedRpId || !parsedOrigin) {
    return false;
  }

  // Special case: localhost is always valid when both match
  if (parsedRpId.hostname === "localhost" && parsedOrigin.hostname === "localhost") {
    return true;
  }

  // The origin's scheme must be https.
  if (!origin.startsWith("https://")) {
    return false;
  }

  // Reject IP addresses (both must be domain names)
  if (parsedRpId.isIp || parsedOrigin.isIp) {
    return false;
  }

  // Reject single-label domains (TLDs) unless it's localhost
  // This ensures we have proper domains like "example.com" not just "example"
  if (rpId !== "localhost" && !rpId.includes(".")) {
    return false;
  }
  if (parsedOrigin.hostname !== "localhost" && !parsedOrigin.hostname.includes(".")) {
    return false;
  }

  // The registrable domains must match
  // This ensures a.example.com and b.example.com share base domain
  if (parsedRpId.domain !== parsedOrigin.domain) {
    return false;
  }

  // Check exact match
  if (parsedOrigin.hostname === rpId) {
    return true;
  }

  // Check if origin is a subdomain of rpId
  // This prevents "evilaccounts.example.com" from matching "accounts.example.com"
  if (parsedOrigin.hostname.endsWith("." + rpId)) {
    return true;
  }

  return false;
}
