// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";

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
  ) {}

  /**
   * Fetches an attachment via the url, decrypts it's content and saves it to a file
   * @param url - url used to retrieve the attachment
   * @param fileName - filename used when written to disk
   * @param decrypt - Function used to decrypt the response
   * @param output - If output is empty or `--raw` was passed to the initial command the content is output onto stdout
   * @returns Promise<FileResponse>
   */
  protected async saveAttachmentToFile(
    url: string,
    fileName: string,
    decrypt: (resp: globalThis.Response) => Promise<Uint8Array>,
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
      const decBuf = await decrypt(response);
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
}
