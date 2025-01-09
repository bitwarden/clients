import { Utils } from "../../misc/utils";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";

export class BitwardenFileUploadService {
  async upload(
    encryptedFileName: string,
    encryptedFileData: EncArrayBuffer,
    apiCall: (fd: FormData) => Promise<any>,
  ) {
    const fd = new FormData();

    if (Utils.isBrowser) {
      const blob = new Blob([encryptedFileData.buffer], { type: "application/octet-stream" });
      fd.append("data", blob, encryptedFileName);
    } else if (Utils.isNode) {
      fd.append(
        "data",
        Buffer.from(encryptedFileData.buffer) as any,
        {
          filename: encryptedFileName,
          contentType: "application/octet-stream",
        } as any,
      );
    } else {
      throw new Error("Unsupported environment");
    }

    await apiCall(fd);
  }
}
