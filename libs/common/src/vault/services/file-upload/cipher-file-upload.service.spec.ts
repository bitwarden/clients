import { mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer, EncString } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../../abstractions/api.service";
import { ErrorResponse } from "../../../models/response/error.response";
import { FileUploadService } from "../../../platform/abstractions/file-upload/file-upload.service";
import { FileUploadType } from "../../../platform/enums";
import { CipherId, UserId } from "../../../types/guid";
import { CipherSdkService } from "../../abstractions/cipher-sdk.service";

import { CipherFileUploadService } from "./cipher-file-upload.service";

describe("CipherFileUploadService", () => {
  const apiService = mock<ApiService>();
  const fileUploadService = mock<FileUploadService>();
  const cipherSdkService = mock<CipherSdkService>();
  const userId = "test-user-id" as UserId;

  let service: CipherFileUploadService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new CipherFileUploadService(apiService, fileUploadService, cipherSdkService);
  });

  describe("uploadPrepared", () => {
    const cipherIdStr = "5ff8c0b2-1d3e-4f8c-9b2d-1d3e4f8c0b22";
    const attachmentId = "newatt0000000000000000000000000";
    const uploadUrl = "https://upload.example.com/slot";
    const encFileName = new EncString("encrypted-filename");
    const encData = { buffer: new ArrayBuffer(50) } as unknown as EncArrayBuffer;

    it("delegates to fileUploadService.upload with the supplied url and file upload type", async () => {
      fileUploadService.upload.mockResolvedValue(undefined);

      await service.uploadPrepared(
        cipherIdStr,
        attachmentId,
        uploadUrl,
        FileUploadType.Azure,
        encFileName,
        encData,
        userId,
        false,
      );

      expect(fileUploadService.upload).toHaveBeenCalledWith(
        { url: uploadUrl, fileUploadType: FileUploadType.Azure },
        encFileName,
        encData,
        expect.objectContaining({
          postDirect: expect.any(Function),
          renewFileUploadUrl: expect.any(Function),
          rollback: expect.any(Function),
        }),
        undefined,
      );
    });

    it("rewraps ErrorResponse from fileUploadService.upload", async () => {
      const errorResponse = new ErrorResponse({ message: "upload failed" }, 500);
      fileUploadService.upload.mockRejectedValue(errorResponse);

      await expect(
        service.uploadPrepared(
          cipherIdStr,
          attachmentId,
          uploadUrl,
          FileUploadType.Direct,
          encFileName,
          encData,
          userId,
          false,
        ),
      ).rejects.toThrow();
    });

    const captureCallbacks = async (
      isAdmin: boolean,
    ): Promise<{
      renew: () => Promise<string | undefined>;
      rollback: () => Promise<void>;
    }> => {
      let capturedRenew: () => Promise<string | undefined>;
      let capturedRollback: () => Promise<void>;

      fileUploadService.upload.mockImplementation(async (_data, _name, _enc, methods) => {
        capturedRenew = methods.renewFileUploadUrl;
        capturedRollback = methods.rollback;
      });

      await service.uploadPrepared(
        cipherIdStr,
        attachmentId,
        uploadUrl,
        FileUploadType.Direct,
        encFileName,
        encData,
        userId,
        isAdmin,
      );

      return { renew: capturedRenew!, rollback: capturedRollback! };
    };

    it("renew callback always routes through cipherSdkService.renewAttachmentUploadUrl", async () => {
      cipherSdkService.renewAttachmentUploadUrl.mockResolvedValue("https://renewed.example.com");

      const { renew } = await captureCallbacks(false);
      const url = await renew();

      expect(cipherSdkService.renewAttachmentUploadUrl).toHaveBeenCalledWith(
        cipherIdStr as CipherId,
        attachmentId,
        userId,
      );
      expect(url).toBe("https://renewed.example.com");
    });

    it("rollback callback delegates to cipherSdkService.deleteAttachmentWithServer with the supplied isAdmin", async () => {
      const { rollback } = await captureCallbacks(true);
      await rollback();

      expect(cipherSdkService.deleteAttachmentWithServer).toHaveBeenCalledWith(
        cipherIdStr as CipherId,
        attachmentId,
        userId,
        true,
      );
    });
  });
});
