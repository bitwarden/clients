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

  if (url.protocol === "https:") {
    return url.origin;
  }

  if (allowLocalhost && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) {
    return url.origin;
  }

  return null;
}

/** True when a form would submit to a different origin than the page the fill was approved for. */
export function formActionLeavesOrigin(htmlAction: string | undefined, pageUrl: string): boolean {
  if (!htmlAction) {
    return false;
  }

  try {
    return new URL(htmlAction, pageUrl).origin !== new URL(pageUrl).origin;
  } catch {
    return true;
  }
}
