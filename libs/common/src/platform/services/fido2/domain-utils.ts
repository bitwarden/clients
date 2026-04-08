import { parse } from "tldts";

/**
 * Maximum number of unique eTLD+1 labels to process when checking Related Origin Requests.
 * This limit prevents malicious servers from causing excessive processing.
 * Per WebAuthn spec recommendation.
 */
const ROR_MAX_LABELS = 5;

/**
 * Timeout in milliseconds for fetching the .well-known/webauthn endpoint.
 */
const ROR_FETCH_TIMEOUT_MS = 5000;

/**
 * Validates whether a Relying Party ID (rpId) is valid for a given origin according to classic
 * WebAuthn specifications (before Related Origin Requests extension).
 *
 * This implements the core WebAuthn RP ID validation logic:
 * - The origin must use the HTTPS scheme (except localhost)
 * - Both rpId and origin must be valid domain names (not IP addresses)
 * - Both must have the same registrable domain (eTLD+1)
 * - The origin must either exactly match the rpId or be a subdomain of it
 * - Single-label domains are rejected unless they are 'localhost'
 * - Localhost is always valid when both rpId and origin are localhost
 *
 * This is used internally as the first validation step before falling back to
 * Related Origin Requests (ROR) validation.
 *
 * @see https://www.w3.org/TR/webauthn-2/#rp-id
 *
 * @param rpId - The Relying Party identifier to validate
 * @param origin - The origin URL to validate against (must start with https://)
 * @returns `true` if the rpId is valid for the given origin, `false` otherwise
 */
function isValidRpIdInternal(rpId: string, origin: string) {
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
}

/**
 * Checks if the origin is allowed to use the given rpId via Related Origin Requests (ROR).
 * This implements the WebAuthn Related Origin Requests spec which allows an RP to
 * authorize origins from different domains to use its rpId.
 *
 * @see https://w3c.github.io/webauthn/#sctn-related-origins
 *
 * @param rpId - The relying party ID being requested
 * @param origin - The origin making the WebAuthn request
 * @param fetchFn - Optional fetch function for testing, defaults to global fetch
 * @returns Promise that resolves to true if the origin is allowed via ROR, false otherwise
 */
async function isAllowedByRor(
  rpId: string,
  origin: string,
  fetchFn?: typeof fetch,
): Promise<boolean> {
  try {
    const fetchImpl = fetchFn ?? globalThis.fetch;

    // Create abort signal with timeout - use AbortSignal.timeout if available, otherwise use AbortController
    let signal: AbortSignal;
    if (typeof AbortSignal.timeout === "function") {
      signal = AbortSignal.timeout(ROR_FETCH_TIMEOUT_MS);
    } else {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ROR_FETCH_TIMEOUT_MS);
      signal = controller.signal;
    }

    const response = await fetchImpl(`https://${rpId}/.well-known/webauthn`, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return false;
    }

    const data = (await response.json()) as { origins?: unknown };

    if (
      !data ||
      !Array.isArray(data.origins) ||
      !data.origins.every((o) => typeof o === "string") ||
      data.origins.length === 0
    ) {
      return false;
    }

    // Track unique labels (eTLD+1) to enforce the max labels limit
    const labelsSeen = new Set<string>();

    for (const allowedOrigin of data.origins as string[]) {
      try {
        const url = new URL(allowedOrigin);
        const hostname = url.hostname;
        if (!hostname) {
          continue;
        }

        const parsed = parse(hostname, { allowPrivateDomains: true });
        if (!parsed.domain || !parsed.publicSuffix) {
          continue;
        }

        // Extract the label (the part before the public suffix)
        const label = parsed.domain.slice(0, parsed.domain.length - parsed.publicSuffix.length - 1);

        if (!label) {
          continue;
        }

        // Skip if we've already seen max labels and this is a new one
        if (labelsSeen.size >= ROR_MAX_LABELS && !labelsSeen.has(label)) {
          continue;
        }

        // Check for exact origin match
        if (origin === allowedOrigin) {
          return true;
        }

        // Track the label if we haven't hit the limit
        if (labelsSeen.size < ROR_MAX_LABELS) {
          labelsSeen.add(label);
        }
      } catch {
        // Invalid URL, skip this entry
        continue;
      }
    }

    return false;
  } catch {
    // Network error, timeout, or other failure - fail closed
    return false;
  }
}

/* Validates whether a Relying Party ID (rpId) is valid for a given origin according to WebAuthn specifications.
 * If that fails, checks if the origin is authorized via Related Origin Requests (ROR).
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
 * @param fetchFn - Optional fetch function for testing, defaults to global fetch
 * @returns `true` if the rpId is valid for the given origin, `false` otherwise
 *
 */
export async function isValidRpId(
  rpId: string,
  origin: string,
  relatedOriginChecksEnabled: boolean,
  fetchFn?: typeof fetch,
): Promise<boolean> {
  // Classic WebAuthn validation: rpId must be a registrable domain suffix of the origin
  const classicMatch = isValidRpIdInternal(rpId, origin);

  if (classicMatch) {
    return true;
  }

  if (!relatedOriginChecksEnabled) {
    return false;
  }

  // Fall back to Related Origin Requests (ROR) validation
  return await isAllowedByRor(rpId, origin, fetchFn);
}
