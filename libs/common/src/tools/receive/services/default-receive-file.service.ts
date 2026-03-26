import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/sdk-internal";

import { ReceiveFileUploadInput } from "../models/receive-file-upload-input";

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
  ) {}

  async uploadFile(input: ReceiveFileUploadInput): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const encryptedFileData = await this.encryptFile(input);

    // TODO upload the encrypted file data to the server associated with the receive url data in the input
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
      fileName: fileName.encryptedString,
      encapsulatedFileContentEncryptionKey: encapsulatedFileContentEncryptionKey.encryptedString,
    };
  }
}
