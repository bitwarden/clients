import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

// Duplicates Default Change Login Password Service, for now
// Since the former is an Angular injectable service, and we
// need to use the function inside of lit components.
// If primary service can be abstracted, that would be ideal.

export class TemporaryNotificationChangeLoginService {
  async getChangePasswordUrl(cipher: CipherView, fallback = false): Promise<string | null> {
    // Ensure we have a cipher with at least one URI
    if (cipher.type !== CipherType.Login || cipher.login == null || !cipher.login.hasUris) {
      return null;
    }

    // Filter for valid URLs that are HTTP(S)
    const urls = cipher.login.uris
      .map((m) => Utils.getUrl(m.uri))
      .filter((m) => m != null && (m.protocol === "http:" || m.protocol === "https:"));

    if (urls.length === 0) {
      return null;
    }

    for (const url of urls) {
      const [reliable, wellKnownChangeUrl] = await Promise.all([
        this.hasReliableHttpStatusCode(url.origin),
        this.getWellKnownChangePasswordUrl(url.origin),
      ]);

      // Some servers return a 200 OK for a resource that should not exist
      // Which means we cannot trust the well-known URL is valid, so we skip it
      // to avoid potentially sending users to a 404 page
      if (reliable && wellKnownChangeUrl != null) {
        return wellKnownChangeUrl;
      }
    }

    // No reliable well-known URL found, fallback to the first URL

    // @TODO reimplement option in original service to indicate if no URL found.
    // return urls[0].href; (originally)
    return fallback ? urls[0].href : null;
  }

  /**
   * Checks if the server returns a non-200 status code for a resource that should not exist.
   * See https://w3c.github.io/webappsec-change-password-url/response-code-reliability.html#semantics
   * @param urlOrigin The origin of the URL to check
   */
  private async hasReliableHttpStatusCode(urlOrigin: string): Promise<boolean> {
    try {
      const url = new URL(
        "./.well-known/resource-that-should-not-exist-whose-status-code-should-not-be-200",
        urlOrigin,
      );

      const request = new Request(url, {
        method: "GET",
        mode: "same-origin",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
      });

      const response = await fetch(request);
      return !response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Builds a well-known change password URL for the given origin. Attempts to fetch the URL to ensure a valid response
   * is returned. Returns null if the request throws or the response is not 200 OK.
   * See https://w3c.github.io/webappsec-change-password-url/
   * @param urlOrigin The origin of the URL to check
   */
  private async getWellKnownChangePasswordUrl(urlOrigin: string): Promise<string | null> {
    try {
      const url = new URL("./.well-known/change-password", urlOrigin);

      const request = new Request(url, {
        method: "GET",
        mode: "same-origin",
        credentials: "omit",
        cache: "no-store",
        redirect: "follow",
      });

      const response = await fetch(request);

      return response.ok ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
