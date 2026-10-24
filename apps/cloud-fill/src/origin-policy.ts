const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

// The input must come from the browser's own record of the top frame URL, never from a caller.
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

  const isHttps = url.protocol === "https:";
  const isHttpsEligible = isHttps && (allowLocalhost || url.port === "");
  if (isHttpsEligible) {
    return url.origin;
  }

  if (allowLocalhost && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) {
    return url.origin;
  }

  return null;
}

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
