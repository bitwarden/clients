// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { Response } from "../models/response";
import { FileResponse } from "../models/response/file.response";
import { CliUtils } from "../utils";

/**
 * Used to download and save attachments
 */
export abstract class DownloadCommand {
  /**
   * @param encryptService - Needed for decryption of the retrieved attachment
   * @param apiService - Needed to override the existing nativeFetch which is available as of Node 18, to support proxies
   */
  constructor(
    protected encryptService: EncryptService,
    protected apiService: ApiService,
    protected environmentService: EnvironmentService,
    protected platformUtilsService: PlatformUtilsService,
  ) {}

  /**
   * Fetches an attachment via the url, decrypts it's content and saves it to a file
   * @param url - url used to retrieve the attachment
   * @param key - SymmetricCryptoKey to decrypt the file contents
   * @param fileName - filename used when written to disk
   * @param output - If output is empty or `--raw` was passed to the initial command the content is output onto stdout
   * @returns Promise<FileResponse>
   */
  protected async saveAttachmentToFile(
    url: string,
    key: SymmetricCryptoKey,
    fileName: string,
    output?: string,
  ) {
    const response = await this.apiService.nativeFetch(
      new Request(url, { headers: { cache: "no-cache" } }),
    );
    if (response.status !== 200) {
      return Response.error(
        "A " + response.status + " error occurred while downloading the attachment.",
      );
    }

    try {
      const encBuf = await EncArrayBuffer.fromResponse(response);
      const decBuf = await this.encryptService.decryptToBytes(encBuf, key);
      if (process.env.BW_SERVE === "true") {
        const res = new FileResponse(Buffer.from(decBuf), fileName);
        return Response.success(res);
      } else {
        return await CliUtils.saveResultToFile(Buffer.from(decBuf), output, fileName);
      }
    } catch (e) {
      if (typeof e === "string") {
        return Response.error(e);
      } else {
        return Response.error("An error occurred while saving the attachment.");
      }
    }
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
