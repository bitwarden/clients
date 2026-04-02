import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FileUploadType } from "@bitwarden/common/platform/enums";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { ReceiveFileId, ReceiveId } from "@bitwarden/common/types/guid";

import { ReceiveFileUploadInput } from "../models/receive-file-upload-input";
import { ReceiveFileUploadDataResponse } from "../models/response/receive-file-upload-data.response";
import { ReceiveFileView } from "../models/view/receive-file.view";

import { DefaultReceiveFileService } from "./default-receive-file.service";
import { ReceiveApiService } from "./receive-api.service";

// Polyfills for Node test environment (used by AzureFileUploadService internally)
globalThis.Request =
  globalThis.Request ??
  (class Request {
    url: string;
    method: string;
    headers: any;
    body: any;
    cache: string;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = init?.headers ?? {};
      this.body = init?.body;
      this.cache = init?.cache ?? "default";
    }
  } as any);

globalThis.Headers = globalThis.Headers ?? (Map as any);

describe("DefaultReceiveFileService", () => {
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let encryptService: MockProxy<EncryptService>;
  let fileDownloadService: MockProxy<FileDownloadService>;
  let receiveApiService: MockProxy<ReceiveApiService>;
  let apiService: MockProxy<ApiService>;
  let logService: MockProxy<LogService>;
  let sut: DefaultReceiveFileService;

  const mockContentKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
  const mockEncryptedFile = { buffer: new Uint8Array([1, 2, 3]) } as unknown as EncArrayBuffer;
  const mockFileName = { encryptedString: "2.encryptedFileName" } as EncString;
  const mockEncapsulatedKey = { encryptedString: "2.encapsulatedKey" } as EncString;

  beforeEach(() => {
    keyGenerationService = mock<KeyGenerationService>();
    encryptService = mock<EncryptService>();
    fileDownloadService = mock<FileDownloadService>();
    receiveApiService = mock<ReceiveApiService>();
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    keyGenerationService.createKey.mockResolvedValue(mockContentKey);
    encryptService.encryptString.mockResolvedValue(mockFileName);
    encryptService.encryptFileData.mockResolvedValue(mockEncryptedFile);
    encryptService.encapsulateKeyUnsigned.mockResolvedValue(mockEncapsulatedKey);

    sut = new DefaultReceiveFileService(
      keyGenerationService,
      encryptService,
      fileDownloadService,
      receiveApiService,
      apiService,
      logService,
    );
  });

  function createUploadInput(): ReceiveFileUploadInput {
    return {
      unencryptedFileBuffer: new Uint8Array([10, 20, 30]).buffer,
      fileName: "test-file.txt",
      urlData: {
        receiveId: "receive-1" as ReceiveId,
        secretB64: "secret-b64",
        sharedContentEncryptionKeyB64: "scek-b64",
      },
      publicKey: new Uint8Array(32),
    };
  }

  function createUploadResponse(): ReceiveFileUploadDataResponse {
    const response = {
      FileUploadType: FileUploadType.Azure,
      FileId: "file-123",
      Url: "https://storage.example.com/upload?sas=token",
    };
    return new ReceiveFileUploadDataResponse(response);
  }

  describe("uploadFile", () => {
    it("encrypts file, uploads to Azure, and validates", async () => {
      const input = createUploadInput();
      const uploadResponse = createUploadResponse();
      receiveApiService.postReceiveFile.mockResolvedValue(uploadResponse);
      apiService.nativeFetch.mockResolvedValue({ status: 201 } as any);

      await sut.uploadFile(input);

      // Verify encryption happened
      expect(keyGenerationService.createKey).toHaveBeenCalledWith(512);
      expect(encryptService.encryptString).toHaveBeenCalledWith(input.fileName, mockContentKey);
      expect(encryptService.encryptFileData).toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        mockContentKey,
        input.publicKey,
      );

      // Verify API call to get upload URL
      expect(receiveApiService.postReceiveFile).toHaveBeenCalledWith(
        input.urlData.receiveId,
        input.urlData.secretB64,
        {
          fileName: mockFileName.encryptedString,
          fileLength: mockEncryptedFile.buffer.byteLength,
          encapsulatedFileContentEncryptionKey: mockEncapsulatedKey.encryptedString,
        },
      );

      // Verify Azure upload (nativeFetch called with PUT to SAS URL)
      expect(apiService.nativeFetch).toHaveBeenCalled();

      // Verify validation call
      expect(receiveApiService.postReceiveFileValidation).toHaveBeenCalledWith(
        input.urlData.receiveId,
        "file-123",
        input.urlData.secretB64,
      );
    });

    it("throws on unsupported file upload type", async () => {
      const input = createUploadInput();
      const response = {
        FileUploadType: FileUploadType.Direct,
        FileId: "file-123",
        Url: "https://example.com",
      };
      receiveApiService.postReceiveFile.mockResolvedValue(
        new ReceiveFileUploadDataResponse(response),
      );

      await expect(sut.uploadFile(input)).rejects.toThrow(
        "Unsupported file upload type for receives",
      );
    });

    it("throws when encryption fails", async () => {
      const input = createUploadInput();
      encryptService.encryptString.mockResolvedValue({ encryptedString: null } as any);

      await expect(sut.uploadFile(input)).rejects.toThrow("Encryption failure for file upload");
    });
  });

  describe("downloadFile", () => {
    const fileView: ReceiveFileView = {
      id: "file-456" as ReceiveFileId,
      size: "1024",
      fileName: "decrypted-file.txt",
      fileContentEncryptionKey: mockContentKey,
    };
    const receiveId = "receive-1" as ReceiveId;

    it("fetches encrypted file, decrypts, and downloads", async () => {
      const mockEncBuf = { buffer: new Uint8Array([1, 2, 3]) } as unknown as EncArrayBuffer;
      const mockDecryptedData = new Uint8Array([8, 9, 10]);

      jest.spyOn(EncArrayBuffer, "fromResponse").mockResolvedValue(mockEncBuf);
      receiveApiService.getReceiveFileDownload.mockResolvedValue({
        id: fileView.id,
        url: "https://storage.example.com/download?sas=token",
      } as any);
      apiService.nativeFetch.mockResolvedValue({ status: 200 } as any);
      encryptService.decryptFileData.mockResolvedValue(mockDecryptedData);

      await sut.downloadFile(fileView, receiveId);

      expect(receiveApiService.getReceiveFileDownload).toHaveBeenCalledWith(receiveId, fileView.id);
      expect(apiService.nativeFetch).toHaveBeenCalled();
      expect(encryptService.decryptFileData).toHaveBeenCalled();
      expect(fileDownloadService.download).toHaveBeenCalledWith({
        fileName: fileView.fileName,
        blobData: mockDecryptedData,
        downloadMethod: "save",
      });
    });

    it("throws when download fetch fails", async () => {
      receiveApiService.getReceiveFileDownload.mockResolvedValue({
        id: fileView.id,
        url: "https://storage.example.com/download?sas=token",
      } as any);
      apiService.nativeFetch.mockResolvedValue({ status: 404 } as any);

      await expect(sut.downloadFile(fileView, receiveId)).rejects.toThrow(
        "Failed to download file: 404",
      );
    });
  });
});
