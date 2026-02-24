function toURL(input: string | URL): URL | null {
  if (input instanceof URL) {
    return input;
  }
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function effectiveOrigin(url: URL): string | null {
  // The URL spec returns "null" for .origin on non-special schemes
  // (e.g. chrome-extension://) so we build the origin from protocol + host instead.
  // An empty host means no meaningful origin can be compared (file:, data:, etc.).
  if (!url.host) {
    return null;
  }
  return `${url.protocol}//${url.host}`;
}

/**
 * Compares two URLs to determine whether the suspect URL originates from the
 * same host as the canonical URL.
 *
 * Both arguments accept either a string or an existing {@link URL} object.
 *
 * Returns `false` when:
 * - Either argument cannot be parsed as a valid URL
 * - Either URL has no host (e.g. `file:`, `data:` schemes), since URLs without
 *   a meaningful host cannot be distinguished by origin
 *
 * @param canonical - The reference URL whose origin acts as the baseline.
 * @param suspect - The URL being tested against the canonical origin.
 * @returns `true` if both URLs share the same scheme, host, and port; `false` otherwise.
 */
export function urlOriginsMatch(canonical: string | URL, suspect: string | URL): boolean {
  const canonicalUrl = toURL(canonical);
  const suspectUrl = toURL(suspect);

  if (!canonicalUrl || !suspectUrl) {
    return false;
  }

  const canonicalOrigin = effectiveOrigin(canonicalUrl);
  const suspectOrigin = effectiveOrigin(suspectUrl);

  // Safari sends the extension GUID in uppercase while the canonical URL is lowercase,
  // Normalize both to lowercase and trim trailing slashes to avoid browser specific issues.
  const normalizedCanonicalOrigin = canonicalOrigin?.replace(/\/$/, "").toLowerCase();
  const normalizedSuspectOrigin = suspectOrigin?.replace(/\/$/, "").toLowerCase();

  if (!normalizedCanonicalOrigin || !normalizedSuspectOrigin) {
    return false;
  }

  return normalizedCanonicalOrigin === normalizedSuspectOrigin;
}
