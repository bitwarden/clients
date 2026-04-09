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
  const url = window.location.href;
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

function appLinkHost(): string {
  const hostName = window.location.hostname || "";
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
