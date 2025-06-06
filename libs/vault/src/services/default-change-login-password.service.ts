import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ChangeLoginPasswordService } from "../abstractions/change-login-password.service";

@Injectable()
export class DefaultChangeLoginPasswordService implements ChangeLoginPasswordService {
  constructor(
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  /**
   * @inheritDoc
   */
  async getChangePasswordUrl(cipher: CipherView): Promise<string | null> {
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

    // CSP policies on the web and desktop restrict the application from making
    // cross-origin requests, breaking the below .well-known URL checks.
    // For those platforms, this will short circuit and return the first URL.
    // PM-21024 will build a solution for the server side to handle this.
    if (this.platformUtilsService.getClientType() !== "browser") {
      return urls[0].href;
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
    return urls[0].href;
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
