// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as fet from "node-fetch";

import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { Response } from "../models/response";
import { FileResponse } from "../models/response/file.response";
import { CliUtils } from "../utils";

export abstract class DownloadCommand {
  constructor(protected encryptService: EncryptService) {}

  protected async saveAttachmentToFile(
    url: string,
    key: SymmetricCryptoKey,
    fileName: string,
    output?: string,
  ) {
    const response = await fet.default(new fet.Request(url, { headers: { cache: "no-cache" } }));
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
}
