// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { parse } from "tldts";

/**
 * Maximum number of unique eTLD+1 labels to process when checking Related Origin Requests.
 * This limit prevents malicious servers from causing excessive processing.
 * Per WebAuthn spec recommendation.
 */
const ROR_MAX_LABELS = 10;

/**
 * Timeout in milliseconds for fetching the .well-known/webauthn endpoint.
 */
const ROR_FETCH_TIMEOUT_MS = 5000;

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

/**
 * Validates that the given rpId can be used with the given origin.
 *
 * First checks if the rpId is a valid subdomain of the origin (classic WebAuthn validation).
 * If that fails, checks if the origin is authorized via Related Origin Requests (ROR).
 *
 * @param rpId - The relying party ID to validate
 * @param origin - The origin making the WebAuthn request
 * @param fetchFn - Optional fetch function for testing, defaults to global fetch
 * @returns Promise that resolves to true if the rpId is valid for the origin
 */
export async function isValidRpId(
  rpId: string,
  origin: string,
  fetchFn?: typeof fetch,
): Promise<boolean> {
  const parsedOrigin = parse(origin, { allowPrivateDomains: true });
  const parsedRpId = parse(rpId, { allowPrivateDomains: true });

  // Classic WebAuthn validation: rpId must be a registrable domain suffix of the origin
  const classicMatch =
    (parsedOrigin.domain == null &&
      parsedOrigin.hostname == parsedRpId.hostname &&
      parsedOrigin.hostname == "localhost") ||
    (parsedOrigin.domain != null &&
      parsedOrigin.domain == parsedRpId.domain &&
      parsedOrigin.subdomain.endsWith(parsedRpId.subdomain));

  if (classicMatch) {
    return true;
  }

  // Fall back to Related Origin Requests (ROR) validation
  return await isAllowedByRor(rpId, origin, fetchFn);
}
