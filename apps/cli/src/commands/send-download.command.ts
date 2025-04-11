// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { DownloadCommand } from "./download.command";

/**
 * Used to download and save attachments
 */
export abstract class SendDownload extends DownloadCommand {
  /**
   * @param encryptService - Needed for decryption of the retrieved attachment
   * @param apiService - Needed to override the existing nativeFetch which is available as of Node 18, to support proxies
   */
  constructor(
    protected encryptService: EncryptService,
    protected apiService: ApiService,
    protected environmentService: EnvironmentService,
    protected platformUtilsService: PlatformUtilsService,
  ) {
    super(encryptService, apiService);
  }

  protected getIdAndKey(url: URL): [string, string] {
    const result = url.hash.slice(1).split("/").slice(-2);
    return [result[0], result[1]];
  }

  protected async getApiUrl(url: URL) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const urls = env.getUrls();
    if (url.origin === "https://send.bitwarden.com") {
      return "https://api.bitwarden.com";
    } else if (url.origin === urls.api) {
      return url.origin;
    } else if (this.platformUtilsService.isDev() && url.origin === urls.webVault) {
      return urls.api;
    } else {
      return url.origin + "/api";
    }
  }
}
