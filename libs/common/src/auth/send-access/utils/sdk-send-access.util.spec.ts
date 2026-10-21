import { SendHashedPasswordB64 } from "../types/send-hashed-password-b64.type";
import { SendOtp } from "../types/send-otp.type";

import {
  isSendAccessTokenError,
  normalizeSendAccessTokenError,
  toSdkSendAccessCredentials,
} from "./sdk-send-access.util";

describe("sdk-send-access utils", () => {
  describe("toSdkSendAccessCredentials", () => {
    it("maps password credentials", () => {
      const passwordHashB64 = "hash" as SendHashedPasswordB64;

      expect(toSdkSendAccessCredentials({ kind: "password", passwordHashB64 })).toEqual({
        passwordHashB64,
      });
    });

    it("maps email credentials", () => {
      expect(toSdkSendAccessCredentials({ kind: "email", email: "a@b.com" })).toEqual({
        email: "a@b.com",
      });
    });

    it("maps email and otp credentials", () => {
      const otp = "123456" as SendOtp;

      expect(toSdkSendAccessCredentials({ kind: "email_otp", email: "a@b.com", otp })).toEqual({
        email: "a@b.com",
        otp,
      });
    });

    it("returns undefined when no credentials are given", () => {
      expect(toSdkSendAccessCredentials(undefined)).toBeUndefined();
    });
  });

  describe("isSendAccessTokenError", () => {
    it.each([
      { kind: "expected", data: {} },
      { kind: "unexpected", data: {} },
    ])("recognizes kind $kind", (e) => {
      expect(isSendAccessTokenError(e)).toBe(true);
    });

    it.each([null, undefined, "expected", new Error("expected"), { kind: "other" }, {}])(
      "rejects %p",
      (e) => {
        expect(isSendAccessTokenError(e)).toBe(false);
      },
    );
  });

  describe("normalizeSendAccessTokenError", () => {
    it("maps an expected SDK error to expected_server", () => {
      const data = { error: "invalid_grant", send_access_error_type: "send_id_invalid" };

      expect(normalizeSendAccessTokenError({ kind: "expected", data })).toEqual({
        kind: "expected_server",
        error: data,
      });
    });

    it("maps an unexpected SDK error to unexpected_server", () => {
      const data = { message: "boom" };

      expect(normalizeSendAccessTokenError({ kind: "unexpected", data })).toEqual({
        kind: "unexpected_server",
        error: data,
      });
    });

    it("maps an Error to unknown with its message", () => {
      expect(normalizeSendAccessTokenError(new Error("network down"))).toEqual({
        kind: "unknown",
        error: "network down",
      });
    });

    it("maps any other value to unknown with its JSON", () => {
      expect(normalizeSendAccessTokenError({ foo: "bar" })).toEqual({
        kind: "unknown",
        error: '{"foo":"bar"}',
      });
    });

    it("falls back when the value cannot be stringified", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(normalizeSendAccessTokenError(circular)).toEqual({
        kind: "unknown",
        error: "error cannot be stringified",
      });
    });
  });
});
