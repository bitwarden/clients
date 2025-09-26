import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  SendAccessTokenApiErrorResponse,
  SendAccessTokenError,
  SendAccessTokenInvalidGrantError,
  SendAccessTokenInvalidRequestError,
  SendAccessTokenResponse,
  UnexpectedIdentityError,
} from "@bitwarden/sdk-internal";
import { FakeGlobalState, FakeGlobalStateProvider } from "@bitwarden/state-test-utils";

import {
  SendHashedPassword,
  SendPasswordKeyMaterial,
  SendPasswordService,
} from "../../../key-management/sends";
import { Utils } from "../../../platform/misc/utils";
import { MockSdkService } from "../../../platform/spec/mock-sdk.service";
import { SendAccessToken } from "../models/send-access-token";
import { GetSendAccessTokenError } from "../types/get-send-access-token-error.type";
import { SendAccessDomainCredentials } from "../types/send-access-domain-credentials.type";
import { SendHashedPasswordB64 } from "../types/send-hashed-password-b64.type";
import { SendOtp } from "../types/send-otp.type";

import { DefaultSendTokenService } from "./default-send-token.service";
import { SEND_ACCESS_TOKEN_DICT } from "./send-access-token-dict.state";

describe("SendTokenService", () => {
  let service: DefaultSendTokenService;

  // Deps
  let sdkService: MockSdkService;
  let globalStateProvider: FakeGlobalStateProvider;
  let sendPasswordService: MockProxy<SendPasswordService>;

  beforeEach(() => {
    globalStateProvider = new FakeGlobalStateProvider();
    sdkService = new MockSdkService();
    sendPasswordService = mock<SendPasswordService>();

    service = new DefaultSendTokenService(globalStateProvider, sdkService, sendPasswordService);
  });

  it("instantiates", () => {
    expect(service).toBeTruthy();
  });

  describe("Send access token retrieval tests", () => {
    let sendAccessTokenDictGlobalState: FakeGlobalState<Record<string, SendAccessToken>>;

    let sendAccessTokenResponse: SendAccessTokenResponse;

    let sendId: string;
    let sendAccessToken: SendAccessToken;
    let token: string;
    let tokenExpiresAt: number;

    const EXPECTED_SERVER_KIND: GetSendAccessTokenError["kind"] = "expected_server";
    const UNEXPECTED_SERVER_KIND: GetSendAccessTokenError["kind"] = "unexpected_server";

    const INVALID_REQUEST_CODES: SendAccessTokenInvalidRequestError[] = [
      "send_id_required",
      "password_hash_b64_required",
      "email_required",
      "email_and_otp_required_otp_sent",
      "unknown",
    ];

    const INVALID_GRANT_CODES: SendAccessTokenInvalidGrantError[] = [
      "send_id_invalid",
      "password_hash_b64_invalid",
      "email_invalid",
      "otp_invalid",
      "otp_generation_failed",
      "unknown",
    ];

    const CREDS = [
      { kind: "password", passwordHashB64: "h4sh" as SendHashedPasswordB64 },
      { kind: "email", email: "u@example.com" },
      { kind: "email_otp", email: "u@example.com", otp: "123456" as SendOtp },
    ] as const satisfies readonly SendAccessDomainCredentials[];

    type SendAccessTokenApiErrorResponseErrorCode = SendAccessTokenApiErrorResponse["error"];

    type SimpleErrorType = Exclude<
      SendAccessTokenApiErrorResponseErrorCode,
      "invalid_request" | "invalid_grant"
    >;

    // Extract out simple error types which don't have complex send_access_error_types to handle.
    const SIMPLE_ERROR_TYPES = [
      "invalid_client",
      "unauthorized_client",
      "unsupported_grant_type",
      "invalid_scope",
      "invalid_target",
    ] as const satisfies readonly SimpleErrorType[];

    beforeEach(() => {
      sendId = "sendId";
      token = "sendAccessToken";
      tokenExpiresAt = Date.now() + 1000 * 60 * 5; // 5 minutes from now

      sendAccessTokenResponse = {
        token: token,
        expiresAt: tokenExpiresAt,
      };

      sendAccessToken = SendAccessToken.fromSendAccessTokenResponse(sendAccessTokenResponse);

      sendAccessTokenDictGlobalState = globalStateProvider.getFake(SEND_ACCESS_TOKEN_DICT);
      // Ensure the state is empty before each test
      sendAccessTokenDictGlobalState.stateSubject.next({});
    });

    describe("tryGetSendAccessToken$", () => {
      it("returns the send access token from session storage when token exists and isn't expired", async () => {
        // Arrange
        // Store the send access token in the global state
        sendAccessTokenDictGlobalState.stateSubject.next({ [sendId]: sendAccessToken });

        // Act
        const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

        // Assert
        expect(result).toEqual(sendAccessToken);
      });

      it("returns expired error and clears token from storage when token is expired", async () => {
        // Arrange
        const oldDate = new Date("2025-01-01");
        const expiredSendAccessToken = new SendAccessToken(token, oldDate.getTime());
        sendAccessTokenDictGlobalState.stateSubject.next({ [sendId]: expiredSendAccessToken });

        // Act
        const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

        // Assert
        expect(result).not.toBeInstanceOf(SendAccessToken);
        expect(result).toStrictEqual({ kind: "expired" });

        // assert that we removed the expired token from storage.
        const sendAccessTokenDict = await firstValueFrom(sendAccessTokenDictGlobalState.state$);
        expect(sendAccessTokenDict).not.toHaveProperty(sendId);
      });

      it("calls to get a new token if none is found in storage and stores the retrieved token in session storage", async () => {
        // Arrange
        sdkService.client.auth
          .mockDeep()
          .send_access.mockDeep()
          .request_send_access_token.mockResolvedValue(sendAccessTokenResponse);

        // Act
        const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

        // Assert
        expect(result).toBeInstanceOf(SendAccessToken);
        expect(result).toEqual(sendAccessToken);
        const sendAccessTokenDict = await firstValueFrom(sendAccessTokenDictGlobalState.state$);
        expect(sendAccessTokenDict).toHaveProperty(sendId, sendAccessToken);
      });

      describe("handles expected invalid_request scenarios appropriately", () => {
        it.each(INVALID_REQUEST_CODES)(
          "surfaces %s as an expected invalid_request error",
          async (code) => {
            // Arrange
            const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
              error: "invalid_request",
              error_description: code,
              send_access_error_type: code,
            };
            mockSdkRejectWith({
              kind: "expected",
              data: sendAccessTokenApiErrorResponse,
            });

            // Act
            const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

            // Assert
            expect(result).toEqual({
              kind: EXPECTED_SERVER_KIND,
              error: sendAccessTokenApiErrorResponse,
            });
          },
        );

        it("handles bare expected invalid_request scenario appropriately", async () => {
          const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
            error: "invalid_request",
          };
          mockSdkRejectWith({
            kind: "expected",
            data: sendAccessTokenApiErrorResponse,
          });

          // Act
          const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

          // Assert
          expect(result).toEqual({
            kind: EXPECTED_SERVER_KIND,
            error: sendAccessTokenApiErrorResponse,
          });
        });
      });

      it.each(SIMPLE_ERROR_TYPES)("handles expected %s error appropriately", async (errorType) => {
        const api: SendAccessTokenApiErrorResponse = {
          error: errorType,
          error_description: `The ${errorType} error occurred`,
        };
        mockSdkRejectWith({ kind: "expected", data: api });

        const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

        expect(result).toEqual({ kind: EXPECTED_SERVER_KIND, error: api });
      });

      it.each(SIMPLE_ERROR_TYPES)(
        "handles expected %s bare error appropriately",
        async (errorType) => {
          const api: SendAccessTokenApiErrorResponse = { error: errorType };
          mockSdkRejectWith({ kind: "expected", data: api });

          const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

          expect(result).toEqual({ kind: EXPECTED_SERVER_KIND, error: api });
        },
      );

      describe("handles expected invalid_grant scenarios appropriately", () => {
        it.each(INVALID_GRANT_CODES)(
          "surfaces %s as an expected invalid_grant error",
          async (code) => {
            // Arrange
            const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
              error: "invalid_grant",
              error_description: code,
              send_access_error_type: code,
            };
            mockSdkRejectWith({
              kind: "expected",
              data: sendAccessTokenApiErrorResponse,
            });

            // Act
            const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

            // Assert
            expect(result).toEqual({
              kind: EXPECTED_SERVER_KIND,
              error: sendAccessTokenApiErrorResponse,
            });
          },
        );

        it("handles bare expected invalid_grant scenario appropriately", async () => {
          const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
            error: "invalid_grant",
          };
          mockSdkRejectWith({
            kind: "expected",
            data: sendAccessTokenApiErrorResponse,
          });

          // Act
          const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

          // Assert
          expect(result).toEqual({
            kind: EXPECTED_SERVER_KIND,
            error: sendAccessTokenApiErrorResponse,
          });
        });
      });

      it("surfaces unexpected errors as unexpected_server error", async () => {
        // Arrange
        const unexpectedIdentityError: UnexpectedIdentityError = "unexpected error occurred";

        mockSdkRejectWith({
          kind: "unexpected",
          data: unexpectedIdentityError,
        });

        // Act
        const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

        // Assert
        expect(result).toEqual({
          kind: UNEXPECTED_SERVER_KIND,
          error: unexpectedIdentityError,
        });
      });

      it("surfaces an unknown error as an unknown error", async () => {
        // Arrange
        const unknownError = "unknown error occurred";

        sdkService.client.auth
          .mockDeep()
          .send_access.mockDeep()
          .request_send_access_token.mockRejectedValue(new Error(unknownError));

        // Act
        const result = await firstValueFrom(service.tryGetSendAccessToken$(sendId));

        // Assert
        expect(result).toEqual({
          kind: "unknown",
          error: unknownError,
        });
      });
    });

    describe("getSendAccessToken$", () => {
      it("returns a send access token for a password protected send when given valid password credentials", async () => {
        // Arrange
        const sendPasswordCredentials: SendAccessDomainCredentials = {
          kind: "password",
          passwordHashB64: "testPassword" as SendHashedPasswordB64,
        };

        sdkService.client.auth
          .mockDeep()
          .send_access.mockDeep()
          .request_send_access_token.mockResolvedValue(sendAccessTokenResponse);

        // Act
        const result = await firstValueFrom(
          service.getSendAccessToken$(sendId, sendPasswordCredentials),
        );

        // Assert
        expect(result).toEqual(sendAccessToken);

        const sendAccessTokenDict = await firstValueFrom(sendAccessTokenDictGlobalState.state$);
        expect(sendAccessTokenDict).toHaveProperty(sendId, sendAccessToken);
      });

      // Note: we deliberately aren't testing the "success" scenario of passing
      // just SendEmailCredentials as that will never return a send access token on it's own.

      it("returns a send access token for a email + otp protected send when given valid email and otp", async () => {
        // Arrange
        const sendEmailOtpCredentials: SendAccessDomainCredentials = {
          kind: "email_otp",
          email: "test@example.com",
          otp: "123456" as SendOtp,
        };

        sdkService.client.auth
          .mockDeep()
          .send_access.mockDeep()
          .request_send_access_token.mockResolvedValue(sendAccessTokenResponse);

        // Act
        const result = await firstValueFrom(
          service.getSendAccessToken$(sendId, sendEmailOtpCredentials),
        );

        // Assert
        expect(result).toEqual(sendAccessToken);
        const sendAccessTokenDict = await firstValueFrom(sendAccessTokenDictGlobalState.state$);
        expect(sendAccessTokenDict).toHaveProperty(sendId, sendAccessToken);
      });

      describe.each(CREDS.map((c) => [c.kind, c] as const))(
        "scenarios with %s credentials",
        (_label, creds) => {
          it.each(INVALID_REQUEST_CODES)(
            "handles expected invalid_request.%s scenario appropriately",
            async (code) => {
              const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
                error: "invalid_request",
                error_description: code,
                send_access_error_type: code,
              };

              mockSdkRejectWith({
                kind: "expected",
                data: sendAccessTokenApiErrorResponse,
              });

              const result = await firstValueFrom(service.getSendAccessToken$("abc123", creds));

              expect(result).toEqual({
                kind: "expected_server",
                error: sendAccessTokenApiErrorResponse,
              });
            },
          );

          it("handles expected invalid_request scenario appropriately", async () => {
            const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
              error: "invalid_request",
            };
            mockSdkRejectWith({
              kind: "expected",
              data: sendAccessTokenApiErrorResponse,
            });

            // Act
            const result = await firstValueFrom(service.getSendAccessToken$(sendId, creds));

            // Assert
            expect(result).toEqual({
              kind: "expected_server",
              error: sendAccessTokenApiErrorResponse,
            });
          });

          it.each(INVALID_GRANT_CODES)(
            "handles expected invalid_grant.%s scenario appropriately",
            async (code) => {
              const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
                error: "invalid_grant",
                error_description: code,
                send_access_error_type: code,
              };

              mockSdkRejectWith({
                kind: "expected",
                data: sendAccessTokenApiErrorResponse,
              });

              const result = await firstValueFrom(service.getSendAccessToken$("abc123", creds));

              expect(result).toEqual({
                kind: "expected_server",
                error: sendAccessTokenApiErrorResponse,
              });
            },
          );

          it("handles expected invalid_grant scenario appropriately", async () => {
            const sendAccessTokenApiErrorResponse: SendAccessTokenApiErrorResponse = {
              error: "invalid_grant",
            };
            mockSdkRejectWith({
              kind: "expected",
              data: sendAccessTokenApiErrorResponse,
            });

            // Act
            const result = await firstValueFrom(service.getSendAccessToken$(sendId, creds));

            // Assert
            expect(result).toEqual({
              kind: "expected_server",
              error: sendAccessTokenApiErrorResponse,
            });
          });

          it.each(SIMPLE_ERROR_TYPES)(
            "handles expected %s error appropriately",
            async (errorType) => {
              const api: SendAccessTokenApiErrorResponse = {
                error: errorType,
                error_description: `The ${errorType} error occurred`,
              };
              mockSdkRejectWith({ kind: "expected", data: api });

              const result = await firstValueFrom(service.getSendAccessToken$(sendId, creds));

              expect(result).toEqual({ kind: EXPECTED_SERVER_KIND, error: api });
            },
          );

          it.each(SIMPLE_ERROR_TYPES)(
            "handles expected %s bare error appropriately",
            async (errorType) => {
              const api: SendAccessTokenApiErrorResponse = { error: errorType };
              mockSdkRejectWith({ kind: "expected", data: api });

              const result = await firstValueFrom(service.getSendAccessToken$(sendId, creds));

              expect(result).toEqual({ kind: EXPECTED_SERVER_KIND, error: api });
            },
          );

          it("surfaces unexpected errors as unexpected_server error", async () => {
            // Arrange
            const unexpectedIdentityError: UnexpectedIdentityError = "unexpected error occurred";

            mockSdkRejectWith({
              kind: "unexpected",
              data: unexpectedIdentityError,
            });

            // Act
            const result = await firstValueFrom(service.getSendAccessToken$(sendId, creds));

            // Assert
            expect(result).toEqual({
              kind: UNEXPECTED_SERVER_KIND,
              error: unexpectedIdentityError,
            });
          });

          it("surfaces an unknown error as an unknown error", async () => {
            // Arrange
            const unknownError = "unknown error occurred";

            sdkService.client.auth
              .mockDeep()
              .send_access.mockDeep()
              .request_send_access_token.mockRejectedValue(new Error(unknownError));

            // Act
            const result = await firstValueFrom(service.getSendAccessToken$(sendId, creds));

            // Assert
            expect(result).toEqual({
              kind: "unknown",
              error: unknownError,
            });
          });
        },
      );

      it("errors if passwordHashB64 is missing for password credentials", async () => {
        const creds: SendAccessDomainCredentials = {
          kind: "password",
          passwordHashB64: "" as SendHashedPasswordB64,
        };
        await expect(firstValueFrom(service.getSendAccessToken$(sendId, creds))).rejects.toThrow(
          "passwordHashB64 must be provided for password credentials.",
        );
      });

      it("errors if email is missing for email credentials", async () => {
        const creds: SendAccessDomainCredentials = {
          kind: "email",
          email: "",
        };
        await expect(firstValueFrom(service.getSendAccessToken$(sendId, creds))).rejects.toThrow(
          "email must be provided for email credentials.",
        );
      });

      it("errors if email or otp is missing for email_otp credentials", async () => {
        const creds: SendAccessDomainCredentials = {
          kind: "email_otp",
          email: "",
          otp: "" as SendOtp,
        };
        await expect(firstValueFrom(service.getSendAccessToken$(sendId, creds))).rejects.toThrow(
          "email and otp must be provided for email_otp credentials.",
        );
      });
    });

    describe("invalidateSendAccessToken", () => {
      it("removes a send access token from storage", async () => {
        // Arrange
        sendAccessTokenDictGlobalState.stateSubject.next({ [sendId]: sendAccessToken });

        // Act
        await service.invalidateSendAccessToken(sendId);
        const sendAccessTokenDict = await firstValueFrom(sendAccessTokenDictGlobalState.state$);

        // Assert
        expect(sendAccessTokenDict).not.toHaveProperty(sendId);
      });
    });
  });

  describe("hashSendPassword", () => {
    test.each(["", null, undefined])("rejects if password is %p", async (pwd) => {
      await expect(service.hashSendPassword(pwd as any, "keyMaterialUrlB64")).rejects.toThrow(
        "Password must be provided.",
      );
    });

    test.each(["", null, undefined])(
      "rejects if keyMaterialUrlB64 is %p",
      async (keyMaterialUrlB64) => {
        await expect(
          service.hashSendPassword("password", keyMaterialUrlB64 as any),
        ).rejects.toThrow("KeyMaterialUrlB64 must be provided.");
      },
    );

    it("correctly hashes the password", async () => {
      // Arrange
      const password = "testPassword";
      const keyMaterialUrlB64 = "testKeyMaterialUrlB64";
      const keyMaterialArray = new Uint8Array([1, 2, 3]) as SendPasswordKeyMaterial;
      const hashedPasswordArray = new Uint8Array([4, 5, 6]) as SendHashedPassword;
      const sendHashedPasswordB64 = "hashedPasswordB64" as SendHashedPasswordB64;

      const utilsFromUrlB64ToArraySpy = jest
        .spyOn(Utils, "fromUrlB64ToArray")
        .mockReturnValue(keyMaterialArray);

      sendPasswordService.hashPassword.mockResolvedValue(hashedPasswordArray);

      const utilsFromBufferToB64Spy = jest
        .spyOn(Utils, "fromBufferToB64")
        .mockReturnValue(sendHashedPasswordB64);

      // Act
      const result = await service.hashSendPassword(password, keyMaterialUrlB64);

      // Assert
      expect(sendPasswordService.hashPassword).toHaveBeenCalledWith(password, keyMaterialArray);
      expect(utilsFromUrlB64ToArraySpy).toHaveBeenCalledWith(keyMaterialUrlB64);
      expect(utilsFromBufferToB64Spy).toHaveBeenCalledWith(hashedPasswordArray);
      expect(result).toBe(sendHashedPasswordB64);
    });
  });

  function mockSdkRejectWith(sendAccessTokenError: SendAccessTokenError) {
    sdkService.client.auth
      .mockDeep()
      .send_access.mockDeep()
      .request_send_access_token.mockRejectedValue(sendAccessTokenError);
  }
});
