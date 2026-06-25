/**
 * Returns the set of URL variations that should match a given sub-frame URL.
 *
 * Frame URLs reported by different sources can diverge in normalization:
 * trailing slashes, omitted protocol or hostname, search/hash components, etc.
 * This helper enumerates the variations that a caller may want to compare
 * against (e.g. via Set membership) so a strict equality check is not the
 * only way to identify a matching frame.
 *
 * Returns `null` if the input cannot be parsed as a URL.
 *
 * @param subFrameUrl - The URL of the sub frame. May be relative when
 *   `baseUrl` is provided.
 * @param baseUrl - Base URL used to resolve relative `subFrameUrl` values.
 *   Defaults to the current global location when available, mirroring the
 *   behavior used by content-script callers.
 */
export function getSubFrameUrlVariations(
  subFrameUrl: string,
  baseUrl: string | undefined = typeof globalThis !== "undefined"
    ? globalThis.location?.href
    : undefined,
): Set<string> | null {
  let url: URL;
  try {
    url = baseUrl ? new URL(subFrameUrl, baseUrl) : new URL(subFrameUrl);
  } catch {
    return null;
  }

  const pathAndHash = url.pathname + url.hash;
  const pathAndSearch = url.pathname + url.search;
  const pathSearchAndHash = pathAndSearch + url.hash;
  const pathNameWithoutTrailingSlash = url.pathname.replace(/\/$/, "");
  const pathWithoutTrailingSlashAndHash = pathNameWithoutTrailingSlash + url.hash;
  const pathWithoutTrailingSlashAndSearch = pathNameWithoutTrailingSlash + url.search;
  const pathWithoutTrailingSlashSearchAndHash = pathWithoutTrailingSlashAndSearch + url.hash;

  return new Set([
    url.href,
    url.href.replace(/\/$/, ""),
    url.pathname,
    pathAndHash,
    pathAndSearch,
    pathSearchAndHash,
    pathNameWithoutTrailingSlash,
    pathWithoutTrailingSlashAndHash,
    pathWithoutTrailingSlashAndSearch,
    pathWithoutTrailingSlashSearchAndHash,
    url.hostname + url.pathname,
    url.hostname + pathAndHash,
    url.hostname + pathAndSearch,
    url.hostname + pathSearchAndHash,
    url.hostname + pathNameWithoutTrailingSlash,
    url.hostname + pathWithoutTrailingSlashAndHash,
    url.hostname + pathWithoutTrailingSlashAndSearch,
    url.hostname + pathWithoutTrailingSlashSearchAndHash,
    url.origin + url.pathname,
    url.origin + pathAndHash,
    url.origin + pathAndSearch,
    url.origin + pathSearchAndHash,
    url.origin + pathNameWithoutTrailingSlash,
    url.origin + pathWithoutTrailingSlashAndHash,
    url.origin + pathWithoutTrailingSlashAndSearch,
    url.origin + pathWithoutTrailingSlashSearchAndHash,
  ]);
}
