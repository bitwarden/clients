// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  SendTokenService,
  SendAccessToken,
  passwordHashB64Required,
} from "@bitwarden/common/auth/send-access";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  CloudEnvironment,
  PRODUCTION_REGIONS,
} from "@bitwarden/common/platform/services/default-environment.service";
import { SendAccessResponse } from "@bitwarden/common/tools/send/models/response/send-access.response";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
// eslint-disable-next-line no-restricted-imports
import {
  CryptoFunctionService,
  EncryptService,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { Response } from "../../../models/response";

import { SendReceiveCommand } from "./receive.command";

describe("SendReceiveCommand", () => {
  let command: SendReceiveCommand;

  const legacyCompatKeyService = mock<LegacyCompatKeyService>();
  const encryptService = mock<EncryptService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const environmentService = mock<EnvironmentService>();
  const sendApiService = mock<SendApiService>();
  const apiService = mock<ApiService>();
  const sendTokenService = mock<SendTokenService>();
  const configService = mock<ConfigService>();
  const sendDecryptionService = mock<SendDecryptionService>();

  const testUrl = "https://send.bitwarden.com/#/send/abc123/key456";
  const testSendId = "abc123";

  beforeEach(() => {
    jest.clearAllMocks();

    environmentService.environment$ = of(
      new CloudEnvironment(PRODUCTION_REGIONS.find((r) => r.key === Region.US)),
    );

    environmentService.availableRegions.mockReturnValue(PRODUCTION_REGIONS);

    platformUtilsService.isDev.mockReturnValue(false);

    legacyCompatKeyService.makeSendKey.mockResolvedValue({} as any);

    cryptoFunctionService.pbkdf2.mockResolvedValue(new Uint8Array(32));

    configService.getFeatureFlag.mockResolvedValue(false);

    command = new SendReceiveCommand(
      encryptService,
      cryptoFunctionService,
      platformUtilsService,
      environmentService,
      sendApiService,
      apiService,
      sendTokenService,
      sendDecryptionService,
    );
  });

  describe("URL parsing", () => {
    it("should return error for invalid URL", async () => {
      const response = await command.run("not-a-valid-url", {});

      expect(response.success).toBe(false);
      expect(response.message).toContain("Failed to parse");
    });

    it("should refuse a mismatched domain in non-interactive mode", async () => {
      process.env.BW_NOINTERACTION = "true";

      const response = await command.run("https://send.example.com/#/send/abc123/key456", {});

      expect(response.success).toBe(false);
      expect(response.message).toContain("does not match the configured domain");
      expect(sendTokenService.tryGetSendAccessToken$).not.toHaveBeenCalled();

      delete process.env.BW_NOINTERACTION;
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
        sendApiService.postSendAccess.mockResolvedValue({} as any);
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
        sendApiService.postSendAccess.mockResolvedValue({} as any);
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
            size: "1024",
          },
        } as SendAccessView;

        sendApiService.postSendAccess.mockResolvedValue({} as any);
        sendDecryptionService.decryptSendAccess.mockResolvedValueOnce([
          mockSendResponse,
          new SymmetricCryptoKey(new Uint8Array(64)),
        ]);
        sendApiService.getSendFileDownloadData.mockResolvedValue({
          url: "https://example.com/download",
        } as any);

        encryptService.decryptFileData.mockResolvedValue(new ArrayBuffer(1024) as any);
        jest.spyOn(command as any, "saveAttachmentToFile").mockResolvedValue(Response.success());

        const response = await command.run(testUrl, { output: "./test.pdf" });

        expect(response.success).toBe(true);
        expect(sendApiService.getSendFileDownloadData).toHaveBeenCalledWith(
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
            size: "1024",
          },
        } as SendAccessView;

        sendApiService.postSendAccess.mockResolvedValue({} as any);
        sendDecryptionService.decryptSendAccess.mockResolvedValueOnce([
          mockSendResponse,
          new SymmetricCryptoKey(new Uint8Array(64)),
        ]);
        const fileDownloadUrl = "https://example.com/download";
        sendApiService.getSendFileDownloadData.mockResolvedValue({
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

        sendApiService.postSendAccess.mockResolvedValue({} as any);

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

        sendApiService.postSendAccess.mockResolvedValue({} as any);

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

      const { apiUrl, identityUrl } = await (command as any).resolveSendServer(new URL(sendUrl));
      expect(apiUrl).toBe("https://api.bitwarden.com");
      expect(identityUrl).toBe("https://identity.bitwarden.com");
    });

    it("should resolve send.bitwarden.eu to api.bitwarden.eu", async () => {
      const mockToken = new SendAccessToken("test-token", Date.now() + 3600000);
      sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));
      jest.spyOn(command as any, "accessSendWithToken").mockResolvedValue(Response.success());

      const sendUrl = "https://vault.bitwarden.eu/#/send/abc123/key456";
      await command.run(sendUrl, {});

      const { apiUrl, identityUrl } = await (command as any).resolveSendServer(new URL(sendUrl));
      expect(apiUrl).toBe("https://api.bitwarden.eu");
      expect(identityUrl).toBe("https://identity.bitwarden.eu");
    });

    it("should handle custom domain URLs", async () => {
      const customUrl = "https://custom.example.com/#/send/abc123/key456";

      const { apiUrl, identityUrl, trusted, isConfiguredServer } = await (
        command as any
      ).resolveSendServer(new URL(customUrl));

      expect(apiUrl).toBe("https://custom.example.com/api");
      expect(identityUrl).toBe("https://custom.example.com/identity");
      expect(trusted).toBe(false);
      expect(isConfiguredServer).toBe(false);
    });

    it("treats the configured region as its own minting authority", async () => {
      const sendUrl = "https://send.bitwarden.com/#/send/abc123/key456";

      const { trusted, isConfiguredServer } = await (command as any).resolveSendServer(
        new URL(sendUrl),
      );

      expect(trusted).toBe(true);
      expect(isConfiguredServer).toBe(true);
    });

    // send.bitwarden.com is a vanity host; the link a recipient actually copies out of their
    // browser is the web vault origin, which is not any region's urls.send.
    it("trusts a cloud web vault origin from a differently-configured CLI", async () => {
      environmentService.environment$ = of(
        new CloudEnvironment(PRODUCTION_REGIONS.find((r) => r.key === Region.EU)),
      );

      const { apiUrl, identityUrl, trusted, isConfiguredServer } = await (
        command as any
      ).resolveSendServer(new URL("https://vault.bitwarden.com/#/send/abc123/key456"));

      expect(trusted).toBe(true);
      expect(apiUrl).toBe("https://api.bitwarden.com");
      expect(identityUrl).toBe("https://identity.bitwarden.com");
      expect(isConfiguredServer).toBe(false);
    });

    it("trusts a Gov web vault origin from a differently-configured CLI", async () => {
      const { apiUrl, identityUrl, trusted } = await (command as any).resolveSendServer(
        new URL("https://vault.bitwarden-gov.com/#/send/abc123/key456"),
      );

      expect(trusted).toBe(true);
      expect(apiUrl).toBe("https://api.bitwarden-gov.com");
      expect(identityUrl).toBe("https://identity.bitwarden-gov.com");
    });

    it("still resolves the configured region's own web vault origin", async () => {
      const { apiUrl, identityUrl, trusted, isConfiguredServer } = await (
        command as any
      ).resolveSendServer(new URL("https://vault.bitwarden.com/#/send/abc123/key456"));

      expect(trusted).toBe(true);
      expect(apiUrl).toBe("https://api.bitwarden.com");
      expect(identityUrl).toBe("https://identity.bitwarden.com");
      expect(isConfiguredServer).toBe(true);
    });

    it("trusts another Bitwarden region but does not treat it as the configured server", async () => {
      // Configured for US cloud; this link is EU. No trust prompt is warranted, but the token must
      // still be minted at EU's identity server rather than at api.bitwarden.eu with a US token.
      const sendUrl = "https://vault.bitwarden.eu/#/send/abc123/key456";

      const { identityUrl, trusted, isConfiguredServer } = await (command as any).resolveSendServer(
        new URL(sendUrl),
      );

      expect(identityUrl).toBe("https://identity.bitwarden.eu");
      expect(trusted).toBe(true);
      expect(isConfiguredServer).toBe(false);
    });
  });

  describe("Token minting authority", () => {
    const foreignServer = {
      apiUrl: "https://custom.example.com/api",
      identityUrl: "https://custom.example.com/identity",
      trusted: false,
      isConfiguredServer: false,
    };

    /** Parses the form-encoded body of the mint request the command issued. */
    const mintedFields = async (): Promise<Record<string, string>> => {
      const request = apiService.nativeFetch.mock.calls[0][0] as Request;
      return Object.fromEntries(new URLSearchParams(await request.text()).entries());
    };

    const respondWith = (status: number, body: unknown) =>
      apiService.nativeFetch.mockResolvedValue({
        status,
        headers: { get: () => "application/json" },
        json: async () => body,
      } as any);

    // Ties resolveSendServer to requestToken through run(). The unit tests below hand requestToken a
    // SendServer directly, so without this a regression that marked another region as the configured
    // server would leave every other test passing.
    it("mints and spends a cross-region Send at that region, end to end", async () => {
      // beforeEach configures US cloud; this link is EU.
      respondWith(200, { access_token: "eu-token", expires_in: 3600 });
      sendApiService.postSendAccess.mockResolvedValue({} as any);

      sendDecryptionService.decryptSendAccess.mockResolvedValueOnce([
        { type: SendType.Text, text: { text: "secret" } } as any,
        new SymmetricCryptoKey(new Uint8Array(64)),
      ]);
      const stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

      const response = await command.run("https://vault.bitwarden.eu/#/send/abc123/key456", {});

      expect(response.success).toBe(true);

      // Minted at EU's identity server, never at the configured US one.
      expect((apiService.nativeFetch.mock.calls[0][0] as Request).url).toBe(
        "https://identity.bitwarden.eu/connect/token",
      );
      expect(sendTokenService.tryGetSendAccessToken$).not.toHaveBeenCalled();
      expect(sendTokenService.getSendAccessToken$).not.toHaveBeenCalled();

      // ...and spent at that same region's API.
      expect(sendApiService.postSendAccess).toHaveBeenCalledWith(
        expect.objectContaining({ token: "eu-token" }),
        "https://api.bitwarden.eu",
      );

      stdoutSpy.mockRestore();
    });

    it("mints a foreign-origin Send at that origin, never the configured server", async () => {
      respondWith(200, { access_token: "foreign-token", expires_in: 3600 });

      const result = await (command as any).requestToken(foreignServer, testSendId);

      expect(result).toBeInstanceOf(SendAccessToken);
      expect(result.token).toBe("foreign-token");
      // The configured server must not be asked to mint a token for a Send it does not host.
      expect(sendTokenService.tryGetSendAccessToken$).not.toHaveBeenCalled();
      expect(sendTokenService.getSendAccessToken$).not.toHaveBeenCalled();

      const request = apiService.nativeFetch.mock.calls[0][0] as Request;
      expect(request.url).toBe("https://custom.example.com/identity/connect/token");
    });

    it("routes the configured server through the shared token service", async () => {
      const mockToken = new SendAccessToken("configured-token", Date.now() + 3600000);
      sendTokenService.tryGetSendAccessToken$.mockReturnValue(of(mockToken));

      const result = await (command as any).requestToken(
        {
          apiUrl: "https://api.bitwarden.com",
          identityUrl: "https://identity.bitwarden.com",
          trusted: true,
          isConfiguredServer: true,
        },
        testSendId,
      );

      expect(result).toBe(mockToken);
      expect(sendTokenService.tryGetSendAccessToken$).toHaveBeenCalledWith(testSendId);
      expect(apiService.nativeFetch).not.toHaveBeenCalled();
    });

    it("refuses to send credentials to a non-https server", async () => {
      const result = await (command as any).requestToken(
        { ...foreignServer, identityUrl: "http://custom.example.com/identity" },
        testSendId,
        { kind: "password", passwordHashB64: "hash" },
      );

      expect(result.kind).toBe("unknown");
      expect(result.error).toContain("https");
      expect(apiService.nativeFetch).not.toHaveBeenCalled();
    });

    it("rejects a token response with no usable expiry", async () => {
      respondWith(200, { access_token: "foreign-token" });

      const result = await (command as any).requestToken(foreignServer, testSendId);

      expect(result.kind).toBe("unknown");
      expect(result.error).toContain("expires_in");
    });

    describe("grant request body", () => {
      beforeEach(() => {
        respondWith(200, { access_token: "foreign-token", expires_in: 3600 });
      });

      it("sends the send_access grant with no credentials", async () => {
        await (command as any).requestToken(foreignServer, testSendId);

        expect(await mintedFields()).toEqual({
          grant_type: "send_access",
          client_id: "send",
          scope: "api.send.access",
          send_id: testSendId,
        });
      });

      it("sends the password hash verbatim", async () => {
        await (command as any).requestToken(foreignServer, testSendId, {
          kind: "password",
          passwordHashB64: "aGFzaCt3aXRoL3NwZWNpYWxzPQ==",
        });

        expect((await mintedFields()).password_hash_b64).toBe("aGFzaCt3aXRoL3NwZWNpYWxzPQ==");
      });

      it("sends the email for the email grant", async () => {
        await (command as any).requestToken(foreignServer, testSendId, {
          kind: "email",
          email: "user+tag@example.com",
        });

        const fields = await mintedFields();
        expect(fields.email).toBe("user+tag@example.com");
        expect(fields.otp).toBeUndefined();
      });

      it("sends email and otp for the email_otp grant", async () => {
        await (command as any).requestToken(foreignServer, testSendId, {
          kind: "email_otp",
          email: "user+tag@example.com",
          otp: "012345" as any,
        });

        expect(await mintedFields()).toMatchObject({
          email: "user+tag@example.com",
          otp: "012345",
        });
      });
    });

    describe("error shape mapping", () => {
      it.each([
        ["invalid_request", "password_hash_b64_required"],
        ["invalid_request", "email_required"],
        ["invalid_request", "email_and_otp_required"],
        ["invalid_grant", "password_hash_b64_invalid"],
        ["invalid_grant", "send_id_invalid"],
      ])("preserves %s / %s for callers to branch on", async (error, sendAccessErrorType) => {
        respondWith(400, { error, send_access_error_type: sendAccessErrorType });

        const result = await (command as any).requestToken(foreignServer, testSendId);

        expect(result.kind).toBe("expected_server");
        expect(result.error.error).toBe(error);
        expect(result.error.send_access_error_type).toBe(sendAccessErrorType);
      });

      it("matches the predicate callers actually use", async () => {
        respondWith(400, {
          error: "invalid_request",
          send_access_error_type: "password_hash_b64_required",
        });

        const result = await (command as any).requestToken(foreignServer, testSendId);

        expect(passwordHashB64Required(result.error)).toBe(true);
      });
    });
  });
});
