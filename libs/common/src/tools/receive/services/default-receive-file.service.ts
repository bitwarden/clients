import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";

import { ReceiveFileUploadInput } from "../models/receive-file-upload-input";
import { ReceiveFileView } from "../models/view/receive-file.view";

import { ReceiveFileService } from "./receive-file.service";

interface EncryptFileResult {
  encryptedFile: EncArrayBuffer;
  fileName: EncString;
  encapsulatedFileContentEncryptionKey: EncString;
}

export class DefaultReceiveFileService implements ReceiveFileService {
  constructor(
    private readonly keyGenerationService: KeyGenerationService,
    private readonly encryptService: EncryptService,
    private fileDownloadService: FileDownloadService,
  ) {}
  async uploadFile(input: ReceiveFileUploadInput): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const encryptedFileData = await this.encryptFile(input);

    // TODO upload the encrypted file data to the server associated with the receive url data in the input
  }

  async downloadFile(fileView: ReceiveFileView): Promise<void> {
    // TODO get the encrypted file data from the server using the fileView data
    // fetch ID and URL from server for the file storage.
    // Fetch the encrypted file from the URL

    // Fake data place holder
    const encryptedFileData = new EncArrayBuffer(new Uint8Array(0));

    const fileData = await this.encryptService.decryptFileData(
      encryptedFileData,
      fileView.fileContentEncryptionKey,
    );

    this.fileDownloadService.download({
      fileName: fileView.fileName,
      blobData: fileData as BlobPart,
      downloadMethod: "save",
    });
  }

  private async encryptFile(input: ReceiveFileUploadInput): Promise<EncryptFileResult> {
    const contentEncryptionKey = await this.keyGenerationService.createKey(512);
    const fileName = await this.encryptService.encryptString(input.fileName, contentEncryptionKey);
    const encryptedFile = await this.encryptService.encryptFileData(
      new Uint8Array(input.unencryptedFileBuffer),
      contentEncryptionKey,
    );
    const encapsulatedFileContentEncryptionKey = await this.encryptService.encapsulateKeyUnsigned(
      contentEncryptionKey,
      input.publicKey,
    );

    if (!encapsulatedFileContentEncryptionKey.encryptedString || !fileName.encryptedString) {
      throw new Error("Encryption failure for file upload");
    }

    return {
      encryptedFile,
      fileName: fileName,
      encapsulatedFileContentEncryptionKey: encapsulatedFileContentEncryptionKey,
    };
  }
}
