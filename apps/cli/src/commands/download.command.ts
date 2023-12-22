import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { Response } from "../models/response";
import { FileResponse } from "../models/response/file.response";
import { CliUtils } from "../utils";

export abstract class DownloadCommand {
  constructor(
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
  ) {}

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
      const decBuf = await this.cryptoService.decryptFromBytes(encBuf, key);
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
