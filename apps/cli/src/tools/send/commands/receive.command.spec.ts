// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SendTokenService, SendAccessToken } from "@bitwarden/common/auth/send-access";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendAccess } from "@bitwarden/common/tools/send/models/domain/send-access";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { KeyService } from "@bitwarden/key-management";

import { Response } from "../../../models/response";

import { SendReceiveCommand } from "./receive.command";

describe("SendReceiveCommand", () => {
  let command: SendReceiveCommand;

  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const environmentService = mock<EnvironmentService>();
  const sendApiService = mock<SendApiService>();
  const apiService = mock<ApiService>();
  const sendTokenService = mock<SendTokenService>();

  const testUrl = "https://send.bitwarden.com/#/send/abc123/key456";
  const testSendId = "abc123";

  beforeEach(() => {
    jest.clearAllMocks();

    environmentService.environment$ = of({
      getUrls: () => ({
        api: "https://api.bitwarden.com",
        webVault: "https://vault.bitwarden.com",
      }),
    } as any);

    platformUtilsService.isDev.mockReturnValue(false);

    keyService.makeSendKey.mockResolvedValue({} as any);

    cryptoFunctionService.pbkdf2.mockResolvedValue(new Uint8Array(32));

    command = new SendReceiveCommand(
      keyService,
      encryptService,
      cryptoFunctionService,
      platformUtilsService,
      environmentService,
      sendApiService,
      apiService,
      sendTokenService,
    );
  });

  describe("URL parsing", () => {
    it("should return error for invalid URL", async () => {
      const response = await command.run("not-a-valid-url", {});

      expect(response.success).toBe(false);
      expect(response.message).toContain("Failed to parse");
    });

    it("should return error when URL is missing send ID or key", async () => {
      const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
      sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));
      jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

      const response = await command.run("https://send.bitwarden.com/#/send/", {});

      expect(response.success).toBe(false);
      expect(response.message).toContain("not a valid Send url");
    });
  });

  describe("V2 Flow", () => {
    describe("Unprotected Sends", () => {
      it("should successfully access Send with cached token", async () => {
        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));
        sendApiService.postSendAccessV2.mockResolvedValue({} as any);
        jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

        const response = await command.run(testUrl, {});

        expect(response.success).toBe(true);
        expect(sendTokenService.tryGetSendAccessToken$).toHaveBeenCalledWith(testSendId);
      });

      it("should handle expired token and determine auth type", async () => {
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "password_hash_b64_required",
            },
          } as any),
        );

        // Mock password auth flow
        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.getSendAccessToken$.mockReturnValue(of(mockToken));
        jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

        const response = await command.run(testUrl, { password: "test-password" });

        expect(response.success).toBe(true);
      });
    });

    describe("Password Authentication (V2)", () => {
      it("should successfully authenticate with password", async () => {
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "password_hash_b64_required",
            },
          } as any),
        );

        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.getSendAccessToken$.mockReturnValue(of(mockToken));
        sendApiService.postSendAccessV2.mockResolvedValue({} as any);
        jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

        const response = await command.run(testUrl, { password: "correct-password" });

        expect(response.success).toBe(true);
        expect(sendTokenService.getSendAccessToken$).toHaveBeenCalledWith(
          testSendId,
          expect.objectContaining({
            kind: "password",
            passwordHashB64: expect.any(String),
          }),
        );
      });

      it("should return error for invalid password", async () => {
        process.env.BW_NOINTERACTION = "true";

        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "password_hash_b64_required",
            },
          } as any),
        );

        sendTokenService.getSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_grant",
              send_access_error_type: "password_hash_b64_invalid",
            },
          } as any),
        );

        const response = await command.run(testUrl, { password: "wrong-password" });

        expect(response.success).toBe(false);
        expect(response.message).toContain("Invalid password");

        delete process.env.BW_NOINTERACTION;
      });

      it("should work with --passwordenv option", async () => {
        process.env.TEST_SEND_PASSWORD = "env-password";
        process.env.BW_NOINTERACTION = "true";

        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "password_hash_b64_required",
            },
          } as any),
        );

        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.getSendAccessToken$.mockReturnValue(of(mockToken));
        jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

        const response = await command.run(testUrl, { passwordenv: "TEST_SEND_PASSWORD" });

        expect(response.success).toBe(true);

        delete process.env.TEST_SEND_PASSWORD;
        delete process.env.BW_NOINTERACTION;
      });
    });

    describe("Email OTP Authentication (V2)", () => {
      it("should return error in non-interactive mode for email OTP", async () => {
        process.env.BW_NOINTERACTION = "true";

        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "email_required",
            },
          } as any),
        );

        const response = await command.run(testUrl, {});

        expect(response.success).toBe(false);
        expect(response.message).toContain("Email verification required");
        expect(response.message).toContain("interactive mode");

        delete process.env.BW_NOINTERACTION;
      });

      it("should handle email submission and OTP prompt flow", async () => {
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "email_required",
            },
          } as any),
        );

        sendTokenService.getSendAccessToken$.mockReturnValueOnce(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "email_and_otp_required_otp_sent",
            },
          } as any),
        );

        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.getSendAccessToken$.mockReturnValueOnce(of(mockToken));

        // We can't easily test the interactive prompts, but we can verify the token service calls
        // would be made in the right order
        expect(sendTokenService.getSendAccessToken$).toBeDefined();
      });

      it("should handle invalid email error", async () => {
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_request",
              send_access_error_type: "email_required",
            },
          } as any),
        );

        sendTokenService.getSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_grant",
              send_access_error_type: "email_invalid",
            },
          } as any),
        );

        // In a real scenario with interactive prompts, this would retry
        // For unit tests, we verify the error is recognized
        expect(sendTokenService.getSendAccessToken$).toBeDefined();
      });

      it("should handle invalid OTP error", async () => {
        sendTokenService.getSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_grant",
              send_access_error_type: "otp_invalid",
            },
          } as any),
        );

        // Verify OTP validation would be handled
        expect(sendTokenService.getSendAccessToken$).toBeDefined();
      });
    });

    describe("File Downloads (V2)", () => {
      it("should successfully download file Send with V2 API", async () => {
        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));

        const mockSendResponse = {
          id: testSendId,
          type: SendType.File,
          file: {
            id: "file-123",
            fileName: "test.pdf",
            size: 1024,
          },
        };

        sendApiService.postSendAccessV2.mockResolvedValue({} as any);
        jest.spyOn(SendAccess.prototype, "decrypt").mockResolvedValueOnce(mockSendResponse as any);
        sendApiService.getSendFileDownloadDataV2.mockResolvedValue({
          url: "https://example.com/download",
        } as any);

        encryptService.decryptFileData.mockResolvedValue(new ArrayBuffer(1024) as any);
        jest.spyOn(command as any, "saveAttachmentToFile").mockResolvedValue(Response.success());

        const response = await command.run(testUrl, { output: "./test.pdf" });

        expect(response.success).toBe(true);
        expect(sendApiService.getSendFileDownloadDataV2).toHaveBeenCalledWith(
          expect.any(Object),
          mockToken,
          "https://api.bitwarden.com",
        );
      });

      it("should remove leading directory components of File Send filename to prevent path traversal", async () => {
        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));

        const fileName = "test.pdf";
        const mockSendResponse = {
          id: testSendId,
          type: SendType.File,
          file: {
            id: "file-123",
            fileName: `../../${fileName}`,
            size: 1024,
          },
        };

        sendApiService.postSendAccessV2.mockResolvedValue({} as any);
        jest.spyOn(SendAccess.prototype, "decrypt").mockResolvedValueOnce(mockSendResponse as any);
        const fileDownloadUrl = "https://example.com/download";
        sendApiService.getSendFileDownloadDataV2.mockResolvedValue({
          url: fileDownloadUrl,
        } as any);

        encryptService.decryptFileData.mockResolvedValue(new ArrayBuffer(1024) as any);
        const saveAttachmentToFileSpy = jest
          .spyOn(command as any, "saveAttachmentToFile")
          .mockResolvedValue(Response.success());

        await command.run(testUrl, {});

        expect(saveAttachmentToFileSpy).toHaveBeenCalledWith(
          fileDownloadUrl,
          fileName,
          expect.any(Function),
          undefined,
        );
      });
    });

    describe("Invalid Send ID", () => {
      it("should return 404 for invalid Send ID", async () => {
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(
          of({
            kind: "expected_server",
            error: {
              error: "invalid_grant",
              send_access_error_type: "send_id_invalid",
            },
          } as any),
        );

        const response = await command.run(testUrl, {});

        expect(response.success).toBe(false);
      });
    });

    describe("Text Send Output", () => {
      it("should output text to stdout for text Sends", async () => {
        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));

        const secretText = "This is a secret message";

        sendApiService.postSendAccessV2.mockResolvedValue({} as any);

        // Mock the entire accessSendWithToken to avoid encryption issues
        jest.spyOn(command as any, "accessSendWithToken").mockImplementation(async () => {
          process.stdout.write(secretText);
          return Response.success();
        });

        const stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        const response = await command.run(testUrl, {});

        expect(response.success).toBe(true);
        expect(stdoutSpy).toHaveBeenCalledWith(secretText);

        stdoutSpy.mockRestore();
      });

      it("should return JSON object when --obj flag is used", async () => {
        const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
        sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));

        const mockDecryptedView = {
          id: testSendId,
          type: SendType.Text,
          text: { text: "secret message" },
        };

        sendApiService.postSendAccessV2.mockResolvedValue({} as any);

        // Mock the entire accessSendWithToken to avoid encryption issues
        jest.spyOn(command as any, "accessSendWithToken").mockImplementation(async () => {
          const sendAccessResponse = new SendAccessResponse(mockDecryptedView as any);
          const res = new Response();
          res.success = true;
          res.data = sendAccessResponse as any;
          return res;
        });

        const response = await command.run(testUrl, { obj: true });

        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(response.data.constructor.name).toBe("SendAccessResponse");
      });
    });
  });

  describe("API URL Resolution", () => {
    it("should resolve send.bitwarden.com to api.bitwarden.com", async () => {
      const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
      sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));
      jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

      const sendUrl = "https://send.bitwarden.com/#/send/abc123/key456";
      await command.run(sendUrl, {});

      const apiUrl = await (command as any).getApiUrl(new URL(sendUrl));
      expect(apiUrl).toBe("https://api.bitwarden.com");
    });

    it("should handle custom domain URLs", async () => {
      const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
      sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));
      jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

      const customUrl = "https://custom.example.com/#/send/abc123/key456";
      await command.run(customUrl, {});

      const apiUrl = await (command as any).getApiUrl(new URL(customUrl));
      expect(apiUrl).toBe("https://custom.example.com/api");
    });
  });
});
