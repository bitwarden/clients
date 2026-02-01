import { parse } from "tldts";

/**
 * Validates whether a Relying Party ID (rpId) is valid for a given origin according to WebAuthn specifications.
 *
 * The validation enforces the following rules:
 * - The origin must use the HTTPS scheme
 * - Both rpId and origin must be valid domain names (not IP addresses)
 * - Both must have the same registrable domain (e.g., example.com)
 * - The origin must either exactly match the rpId or be a subdomain of it
 * - Single-label domains are rejected unless they are 'localhost'
 * - Localhost is always valid when both rpId and origin are localhost
 *
 * @param rpId - The Relying Party identifier to validate
 * @param origin - The origin URL to validate against (must start with https://)
 * @returns `true` if the rpId is valid for the given origin, `false` otherwise
 *
 */
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

  if (
    parsedOrigin.hostname != null &&
    parsedOrigin.hostname !== "localhost" &&
    !parsedOrigin.hostname.includes(".")
  ) {
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
  if (parsedOrigin.hostname != null && parsedOrigin.hostname.endsWith("." + rpId)) {
    return true;
  }

  return false;
}
