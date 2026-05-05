import { Utils } from "../../misc/utils";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";

export class BitwardenFileUploadService {
  async upload(
    encryptedFileName: string,
    encryptedFileData: EncArrayBuffer,
    apiCall: (fd: FormData) => Promise<any>,
  ) {
    await this.uploadRaw(encryptedFileName, encryptedFileData.buffer, apiCall);
  }

  async uploadRaw(fileName: string, data: Uint8Array, apiCall: (fd: FormData) => Promise<any>) {
    const fd = new FormData();

    if (Utils.isBrowser) {
      const blob = new Blob([data as BlobPart], {
        type: "application/octet-stream",
      });
      fd.append("data", blob, fileName);
    } else if (Utils.isNode) {
      fd.append(
        "data",
        Buffer.from(data) as any,
        {
          filename: fileName,
          contentType: "application/octet-stream",
        } as any,
      );
    } else {
      throw new Error("Unsupported environment");
    }

    await apiCall(fd);
  }
}
