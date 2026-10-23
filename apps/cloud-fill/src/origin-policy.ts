const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Returns the origin a credential may be requested for, or null if the page is not eligible.
 * The input must come from the browser's own record of the top frame URL.
 */
export function approvedOrigin(topFrameUrl: string | undefined, allowLocalhost: boolean) {
  if (!topFrameUrl) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(topFrameUrl);
  } catch {
    return null;
  }

  if (url.protocol === "https:" && (allowLocalhost || url.port === "")) {
    return url.origin;
  }

  if (allowLocalhost && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) {
    return url.origin;
  }

  return null;
}

/** True when any submit target resolves to a different origin than the page the fill was approved for. */
export function submitTargetsLeaveOrigin(targets: string[], pageUrl: string): boolean {
  const pageOrigin = new URL(pageUrl).origin;
  return targets.some((target) => {
    try {
      return new URL(target).origin !== pageOrigin;
    } catch {
      return true;
    }
  });
}
