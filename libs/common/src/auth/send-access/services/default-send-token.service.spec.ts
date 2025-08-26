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
import { SendHashedPasswordB64 } from "../types/send-hashed-password-b64.type";

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
        const cases: SendAccessTokenInvalidRequestError[] = [
          "send_id_required",
          "password_hash_b64_required",
          "email_required",
          "email_and_otp_required_otp_sent",
          "unknown",
        ];

        it.each(cases)("surfaces %s as an expected invalid_request error", async (code) => {
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
        });
      });

      describe("handles expected invalid_grant scenarios appropriately", () => {
        const cases: SendAccessTokenInvalidGrantError[] = [
          "send_id_invalid",
          "password_hash_b64_invalid",
          "email_invalid",
          "otp_invalid",
          "unknown",
        ];

        it.each(cases)("surfaces %s as an expected invalid_grant error", async (code) => {
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
