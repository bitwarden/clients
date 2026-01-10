import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ChangePasswordUriResponse } from "@bitwarden/common/vault/models/response/change-password-uri.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ChangeLoginPasswordService } from "../abstractions/change-login-password.service";

@Injectable()
export class DefaultChangeLoginPasswordService implements ChangeLoginPasswordService {
  constructor(
    private apiService: ApiService,
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
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

    const enableFaviconChangePassword = await firstValueFrom(
      this.domainSettingsService.showFavicons$,
    );

    // When the setting is not enabled, return the first URL
    if (!enableFaviconChangePassword) {
      return urls[0].href;
    }

    for (const url of urls) {
      const wellKnownChangeUrl = await this.fetchWellKnownChangePasswordUri(url.href);

      if (wellKnownChangeUrl) {
        return wellKnownChangeUrl;
      }
    }

    // No reliable well-known URL found, fallback to the first URL
    return urls[0].href;
  }

  /**
   * Fetches the well-known change-password-uri for the given URL.
   * @returns The full URL to the change password page, or null if it could not be found.
   */
  private async fetchWellKnownChangePasswordUri(url: string): Promise<string | null> {
    const getChangePasswordUriRequest = await this.buildChangePasswordUriRequest(url);

    const response = await this.apiService.fetch(getChangePasswordUriRequest);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const { uri } = new ChangePasswordUriResponse(data);

    return uri;
  }

  /**
   * Construct the request for the change-password-uri endpoint.
   */
  private async buildChangePasswordUriRequest(cipherUri: string): Promise<Request> {
    const searchParams = new URLSearchParams();
    searchParams.set("uri", cipherUri);

    // The change-password-uri endpoint lives within the icons service
    // as it uses decrypted cipher data.
    const env = await firstValueFrom(this.environmentService.environment$);
    const iconsUrl = env.getIconsUrl();

    const url = new URL(`${iconsUrl}/change-password-uri?${searchParams.toString()}`);

    return new Request(url, {
      method: "GET",
    });
  }
}
