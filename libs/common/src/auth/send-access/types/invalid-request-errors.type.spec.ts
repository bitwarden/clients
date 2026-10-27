import {
  SendAccessTokenApiErrorResponse,
  SendAccessTokenInvalidRequestError,
} from "@bitwarden/sdk-internal";

import {
  deviceIdentifierInvalid,
  deviceIdentifierRequired,
  emailAndOtpRequired,
  emailRequired,
  isBareInvalidRequest,
  isInvalidRequest,
  isUnknownInvalidRequest,
  passwordHashB64Required,
  sendIdRequired,
} from "./invalid-request-errors.type";

type Guard = (e: SendAccessTokenApiErrorResponse) => boolean;

// Keyed by every SDK value, so a value added to the SDK fails type checking until it has a guard.
const guardFor = {
  send_id_required: sendIdRequired,
  password_hash_b64_required: passwordHashB64Required,
  email_required: emailRequired,
  email_and_otp_required: emailAndOtpRequired,
  device_identifier_required: deviceIdentifierRequired,
  device_identifier_invalid: deviceIdentifierInvalid,
  unknown: isUnknownInvalidRequest,
} satisfies Record<SendAccessTokenInvalidRequestError, Guard>;

const sendAccessErrorTypes = Object.keys(guardFor) as SendAccessTokenInvalidRequestError[];

const invalidRequest = (
  send_access_error_type?: SendAccessTokenInvalidRequestError,
): SendAccessTokenApiErrorResponse => ({
  error: "invalid_request",
  error_description: "description",
  send_access_error_type,
});

describe("invalid request error guards", () => {
  describe.each(sendAccessErrorTypes)("the %s guard", (sendAccessErrorType) => {
    const guard: Guard = guardFor[sendAccessErrorType];

    it("matches its own send_access_error_type", () => {
      expect(guard(invalidRequest(sendAccessErrorType))).toBe(true);
    });

    it.each(sendAccessErrorTypes.filter((other) => other !== sendAccessErrorType))(
      "does not match %s",
      (other) => {
        expect(guard(invalidRequest(other))).toBe(false);
      },
    );

    it("does not match an invalid_request without a send_access_error_type", () => {
      expect(guard(invalidRequest())).toBe(false);
    });

    it("does not match an invalid_grant with the same send_access_error_type", () => {
      const invalidGrant = {
        error: "invalid_grant",
        send_access_error_type: sendAccessErrorType,
      } as unknown as SendAccessTokenApiErrorResponse;

      expect(guard(invalidGrant)).toBe(false);
    });
  });

  describe("isInvalidRequest", () => {
    it.each([undefined, ...sendAccessErrorTypes])(
      "matches an invalid_request with send_access_error_type %s",
      (sendAccessErrorType) => {
        expect(isInvalidRequest(invalidRequest(sendAccessErrorType))).toBe(true);
      },
    );

    it("does not match an invalid_grant", () => {
      expect(isInvalidRequest({ error: "invalid_grant" })).toBe(false);
    });
  });

  describe("isBareInvalidRequest", () => {
    it("matches an invalid_request without a send_access_error_type", () => {
      expect(isBareInvalidRequest(invalidRequest())).toBe(true);
    });

    it.each(sendAccessErrorTypes)(
      "does not match an invalid_request with send_access_error_type %s",
      (sendAccessErrorType) => {
        expect(isBareInvalidRequest(invalidRequest(sendAccessErrorType))).toBe(false);
      },
    );

    it("does not match an invalid_grant without a send_access_error_type", () => {
      expect(isBareInvalidRequest({ error: "invalid_grant" })).toBe(false);
    });
  });
});
