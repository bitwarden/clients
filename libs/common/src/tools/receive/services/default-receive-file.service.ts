import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FileUploadType } from "@bitwarden/common/platform/enums";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { AzureFileUploadService } from "@bitwarden/common/platform/services/file-upload/azure-file-upload.service";
import { ReceiveId } from "@bitwarden/common/types/guid";

import { ReceiveFileUploadInput } from "../models/receive-file-upload-input";
import { ReceiveFileView } from "../models/view/receive-file.view";

import { ReceiveApiService } from "./receive-api.service";
import { ReceiveFileService } from "./receive-file.service";

interface EncryptFileResult {
  encryptedFile: EncArrayBuffer;
  fileName: EncString;
  encapsulatedFileContentEncryptionKey: EncString;
}

export class DefaultReceiveFileService implements ReceiveFileService {
  private azureFileUploadService: AzureFileUploadService;

  constructor(
    private readonly keyGenerationService: KeyGenerationService,
    private readonly encryptService: EncryptService,
    private fileDownloadService: FileDownloadService,
    private receiveApiService: ReceiveApiService,
    private apiService: ApiService,
    logService: LogService,
  ) {
    this.azureFileUploadService = new AzureFileUploadService(logService, apiService);
  }

  async uploadFile(input: ReceiveFileUploadInput): Promise<void> {
    const encryptedFileData = await this.encryptFile(input);

    const uploadDataResponse = await this.receiveApiService.postReceiveFile(
      input.urlData.receiveId,
      input.urlData.secretB64,
      {
        fileName: encryptedFileData.fileName.encryptedString!,
        fileLength: encryptedFileData.encryptedFile.buffer.byteLength,
        encapsulatedFileContentEncryptionKey:
          encryptedFileData.encapsulatedFileContentEncryptionKey.encryptedString!,
      },
    );

    if (uploadDataResponse.fileUploadType === FileUploadType.Azure) {
      await this.azureFileUploadService.upload(
        uploadDataResponse.url!,
        encryptedFileData.encryptedFile,
        // No-op: receives lack a URL renewal endpoint (unlike sends' GET /sends/{id}/file/{fileId})
        async () => uploadDataResponse.url!,
      );
    } else {
      throw new Error("Unsupported file upload type for receives");
    }

    await this.receiveApiService.postReceiveFileValidation(
      input.urlData.receiveId,
      uploadDataResponse.fileId,
      input.urlData.secretB64,
    );
  }

  async downloadFile(fileView: ReceiveFileView, receiveId: ReceiveId): Promise<void> {
    const downloadData = await this.receiveApiService.getReceiveFileDownload(
      receiveId,
      fileView.id,
    );

    const response = await this.apiService.nativeFetch(new Request(downloadData.url));
    if (response.status !== 200) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const encryptedFileData = await EncArrayBuffer.fromResponse(response);

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
