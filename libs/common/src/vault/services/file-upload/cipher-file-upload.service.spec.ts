import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ApiService } from "../../../abstractions/api.service";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { FileUploadService } from "../../../platform/abstractions/file-upload/file-upload.service";
import { Utils } from "../../../platform/misc/utils";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { CipherId, UserId } from "../../../types/guid";
import { CipherSdkService } from "../../abstractions/cipher-sdk.service";
import { CipherType } from "../../enums/cipher-type";
import { Cipher } from "../../models/domain/cipher";
import { AttachmentUploadDataResponse } from "../../models/response/attachment-upload-data.response";
import { CipherResponse } from "../../models/response/cipher.response";

import { CipherFileUploadService } from "./cipher-file-upload.service";

describe("CipherFileUploadService", () => {
  const apiService = mock<ApiService>();
  const fileUploadService = mock<FileUploadService>();
  const configService = mock<ConfigService>();
  const cipherSdkService = mock<CipherSdkService>();
  const userId = "test-user-id" as UserId;

  let service: CipherFileUploadService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new CipherFileUploadService(
      apiService,
      fileUploadService,
      configService,
      cipherSdkService,
    );
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

      await service.upload(mockCipher, mockEncFileName, mockEncData, false, mockDataEncKey, userId);

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

  describe("rollback callback", () => {
    const cipherIdStr = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22";
    const attachmentId = "uf7bkexzag04d3cw04jsbqqkbpbwhxs0";

    const setupRollback = async (
      isAdmin: boolean,
      flagOn: boolean,
    ): Promise<() => Promise<void>> => {
      const mockCipher = new Cipher({
        id: cipherIdStr,
        type: CipherType.Login,
        name: "Test Cipher",
        revisionDate: "2024-01-15T10:30:00.000Z",
      } as any);

      const mockEncFileName = new EncString("encrypted-filename");
      const mockEncData = { buffer: new ArrayBuffer(100) } as unknown as EncArrayBuffer;
      const mockDataEncKey: [SymmetricCryptoKey, EncString] = [
        new SymmetricCryptoKey(new Uint8Array(32)),
        new EncString("encrypted-key"),
      ];

      const responseFor = (id: string) =>
        ({
          id,
          type: CipherType.Login,
          revisionDate: "2024-01-15T10:30:00.000Z",
        }) as CipherResponse;

      const uploadDataResponse = {
        attachmentId,
        url: "https://upload.example.com",
        fileUploadType: 0,
        cipherResponse: isAdmin ? null : responseFor(cipherIdStr),
        cipherMiniResponse: isAdmin ? responseFor(cipherIdStr) : null,
      } as AttachmentUploadDataResponse;

      apiService.postCipherAttachment.mockResolvedValue(uploadDataResponse);
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM28192_CipherAttachmentOpsToSdk)
        .mockResolvedValue(flagOn);
      configService.getFeatureFlag
        .calledWith(FeatureFlag.PM34410AttachmentUploadProgress)
        .mockResolvedValue(false);

      let capturedRollback: () => Promise<void>;
      fileUploadService.upload.mockImplementation(async (_data, _name, _enc, methods) => {
        capturedRollback = methods.rollback;
      });

      await service.upload(
        mockCipher,
        mockEncFileName,
        mockEncData,
        isAdmin,
        mockDataEncKey,
        userId,
      );

      return capturedRollback!;
    };

    it("calls apiService.deleteCipherAttachment when flag is off and isAdmin is false", async () => {
      const rollback = await setupRollback(false, false);
      await rollback();

      expect(apiService.deleteCipherAttachment).toHaveBeenCalledWith(cipherIdStr, attachmentId);
      expect(apiService.deleteCipherAttachmentAdmin).not.toHaveBeenCalled();
      expect(cipherSdkService.deleteAttachmentWithServer).not.toHaveBeenCalled();
    });

    it("calls apiService.deleteCipherAttachmentAdmin when flag is off and isAdmin is true", async () => {
      const rollback = await setupRollback(true, false);
      await rollback();

      expect(apiService.deleteCipherAttachmentAdmin).toHaveBeenCalledWith(
        cipherIdStr,
        attachmentId,
      );
      expect(apiService.deleteCipherAttachment).not.toHaveBeenCalled();
      expect(cipherSdkService.deleteAttachmentWithServer).not.toHaveBeenCalled();
    });

    it("calls cipherSdkService.deleteAttachmentWithServer with asAdmin=false when flag is on and isAdmin is false", async () => {
      const rollback = await setupRollback(false, true);
      await rollback();

      expect(cipherSdkService.deleteAttachmentWithServer).toHaveBeenCalledWith(
        cipherIdStr as CipherId,
        attachmentId,
        userId,
        false,
      );
      expect(apiService.deleteCipherAttachment).not.toHaveBeenCalled();
      expect(apiService.deleteCipherAttachmentAdmin).not.toHaveBeenCalled();
    });

    it("calls cipherSdkService.deleteAttachmentWithServer with asAdmin=true when flag is on and isAdmin is true", async () => {
      const rollback = await setupRollback(true, true);
      await rollback();

      expect(cipherSdkService.deleteAttachmentWithServer).toHaveBeenCalledWith(
        cipherIdStr as CipherId,
        attachmentId,
        userId,
        true,
      );
      expect(apiService.deleteCipherAttachment).not.toHaveBeenCalled();
      expect(apiService.deleteCipherAttachmentAdmin).not.toHaveBeenCalled();
    });
  });
});
