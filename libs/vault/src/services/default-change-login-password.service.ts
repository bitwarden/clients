import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ChangeLoginPasswordService } from "../abstractions/change-login-password.service";

@Injectable()
export class DefaultChangeLoginPasswordService implements ChangeLoginPasswordService {
  constructor(private apiService: ApiService) {}

  /**
   * @inheritDoc
   */
  async getChangePasswordUrl(cipher: CipherView): Promise<string | null> {
    // Ensure we have a cipher with at least one URI
    if (cipher.type !== CipherType.Login || cipher.login == null || !cipher.login.hasUris) {
      return null;
    }

    // Find the first valid URL that is an HTTP or HTTPS URL
    const url = cipher.login.uris
      .map((m) => Utils.getUrl(m.uri))
      .find((m) => m != null && (m.protocol === "http:" || m.protocol === "https:"));

    if (url == null) {
      return null;
    }

    const [reliable, wellKnownChangeUrl] = await Promise.all([
      this.hasReliableHttpStatusCode(url.origin),
      this.getWellKnownChangePasswordUrl(url.origin),
    ]);

    if (!reliable || wellKnownChangeUrl == null) {
      return cipher.login.uri;
    }

    return wellKnownChangeUrl;
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

      const response = await this.apiService.nativeFetch(request);
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

      const response = await this.apiService.nativeFetch(request);

      return response.ok ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
