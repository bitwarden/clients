import { mock } from "jest-mock-extended";

import { ApiService } from "../../../abstractions/api.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { FileUploadService } from "../../../platform/abstractions/file-upload/file-upload.service";
import { Utils } from "../../../platform/misc/utils";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CipherType } from "../../enums/cipher-type";
import { Cipher } from "../../models/domain/cipher";
import { AttachmentUploadDataResponse } from "../../models/response/attachment-upload-data.response";
import { CipherResponse } from "../../models/response/cipher.response";

import { CipherFileUploadService } from "./cipher-file-upload.service";

describe("CipherFileUploadService", () => {
  const apiService = mock<ApiService>();
  const fileUploadService = mock<FileUploadService>();

  let service: CipherFileUploadService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new CipherFileUploadService(apiService, fileUploadService);
  });

  describe("upload", () => {
    it("should include lastKnownRevisionDate in the attachment request", async () => {
      const cipherId = Utils.newGuid();
      const mockCipher = new Cipher({
        id: cipherId,
        type: CipherType.Login,
        name: "Test Cipher",
        revisionDate: "2024-01-15T10:30:00.000Z",
      } as any);

      const mockEncFileName = new EncString("encrypted-filename");
      const mockEncData = {
        buffer: new ArrayBuffer(100),
      } as unknown as EncArrayBuffer;

      const mockDataEncKey: [SymmetricCryptoKey, EncString] = [
        new SymmetricCryptoKey(new Uint8Array(32)),
        new EncString("encrypted-key"),
      ];

      const mockUploadDataResponse = {
        attachmentId: "attachment-id",
        url: "https://upload.example.com",
        fileUploadType: 0,
        cipherResponse: {
          id: cipherId,
          type: CipherType.Login,
          revisionDate: "2024-01-15T10:30:00.000Z",
        } as CipherResponse,
        cipherMiniResponse: null,
      } as AttachmentUploadDataResponse;

      apiService.postCipherAttachment.mockResolvedValue(mockUploadDataResponse);
      fileUploadService.upload.mockResolvedValue(undefined);

      await service.upload(mockCipher, mockEncFileName, mockEncData, false, mockDataEncKey);

      const callArgs = apiService.postCipherAttachment.mock.calls[0][1];

      expect(apiService.postCipherAttachment).toHaveBeenCalledWith(
        cipherId,
        expect.objectContaining({
          key: "encrypted-key",
          fileName: "encrypted-filename",
          fileSize: 100,
          adminRequest: false,
        }),
      );

      // Verify lastKnownRevisionDate is set (it's converted to a Date object)
      expect(callArgs.lastKnownRevisionDate).toBeDefined();
      expect(callArgs.lastKnownRevisionDate).toEqual(new Date("2024-01-15T10:30:00.000Z"));
    });
  });
});
