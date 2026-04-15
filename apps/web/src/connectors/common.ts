/**
 * Returns true when the connector page is served from a Bitwarden-managed domain.
 * Determined by window.location.hostname, which reflects the actual serving domain.
 */
export function isKnownCloudOrigin(): boolean {
  // https://bitwarden.atlassian.net/browse/PM-32091
  const managedSuffixes = [".bitwarden.com", ".bitwarden.eu", ".bitwarden.pw"];
  const hostname = window.location.hostname || "";
  return managedSuffixes.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Determines the targetOrigin for postMessage calls from the connector.
 *
 * Desktop (file:// parent): preserves the provided parentUrl for Electron compatibility.
 */
export function resolvePostMessageOrigin(parentUrl: string | null): string | null {
  if (parentUrl) {
    try {
      if (new URL(parentUrl).protocol === "file:") {
        return parentUrl;
      }
    } catch {
      // Invalid URL — fall through
    }
  }

  if (isKnownCloudOrigin()) {
    return window.location.origin;
  }
  return parentUrl;
}

export function getQsParam(name: string) {
  const url = getLocationHref();
  // eslint-disable-next-line
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);

  if (!results) {
    return null;
  }
  if (!results[2]) {
    return "";
  }

  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

export function b64Decode(str: string, spaceAsPlus = false) {
  if (spaceAsPlus) {
    str = str.replace(/ /g, "+");
  }

  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), (c: string) => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
}

/** Thin wrapper around document.location.replace for testability (jsdom cannot mock it). */
export function navigateToUrl(uri: string) {
  document.location.replace(uri);
}

/**
 * Get current page URL href for testability.
 *
 * ⚠️ SECURITY: This returns user-controllable data from window.location.href.
 *
 * SAFE uses: parsing query parameters, checking hostname/protocol
 * UNSAFE uses: rendering to DOM innerHTML, template interpolation without sanitization
 *
 * Never pass the raw value to innerHTML, ng-bind, or any DOM rendering context.
 */
export function getLocationHref(): string {
  const href = window.location.href;

  // Validate format and protocol
  try {
    const url = new URL(href);
    if (!["http:", "https:", "about:"].includes(url.protocol)) {
      return "";
    }
  } catch {
    return "";
  }

  return href;
}

/** Set location href (navigation) for testability. */
export function setLocationHref(url: string): void {
  window.location.href = url;
}

/**
 * Get current origin for testability.
 *
 * ⚠️ SECURITY: Origin (scheme + host + port) is generally safe but comes from location.
 * Use carefully when constructing URLs or security-sensitive comparisons.
 */
export function getLocationOrigin(): string {
  try {
    return window.location.origin;
  } catch {
    return "";
  }
}

/**
 * Get current hostname for testability.
 *
 * ⚠️ SECURITY: Hostname comes from location and should not be trusted for rendering.
 * Safe for: domain whitelisting, feature flag routing (bitwarden.com vs .eu vs .pw)
 * Unsafe for: rendering to DOM without validation
 */
export function getLocationHostname(): string {
  try {
    const hostname = window.location.hostname;
    // Validate basic hostname format
    if (!hostname || !/^[a-z0-9.-]+$/i.test(hostname)) {
      return "";
    }
    return hostname;
  } catch {
    return "";
  }
}

function appLinkHost(): string {
  const hostName = getLocationHostname();
  if (hostName.endsWith("bitwarden.eu")) {
    return "bitwarden.eu";
  }
  if (hostName.endsWith("bitwarden.pw")) {
    return "bitwarden.pw";
  }
  return "bitwarden.com";
}

export function buildMobileDeeplinkUriFromParam(kind: "duo" | "webauthn"): string {
  const scheme = (getQsParam("deeplinkScheme") || "").toLowerCase();
  const path = `${kind}-callback`;
  if (scheme === "https") {
    return `https://${appLinkHost()}/${path}`;
  }
  return `bitwarden://${path}`;
}
