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

/** Get current page URL href for testability. */
export function getLocationHref(): string {
  return window.location.href;
}

/** Set location href (navigation) for testability. */
export function setLocationHref(url: string): void {
  window.location.href = url;
}

/** Get current origin for testability. */
export function getLocationOrigin(): string {
  return window.location.origin;
}

/** Get current hostname for testability. */
export function getLocationHostname(): string {
  return window.location.hostname || "";
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
