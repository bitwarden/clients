import { KeeperAuthError, KeeperAuthErrorCode } from "../../importers/keeper/access";

import { keeperValidationErrorI18nKey } from "./keeper-validation-error";

describe("keeperValidationErrorI18nKey", () => {
  it("maps a cancelled MFA prompt", () => {
    expect(
      keeperValidationErrorI18nKey(new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled")),
    ).toBe("multifactorAuthenticationCancelled");
  });

  it("maps a failed MFA attempt", () => {
    expect(
      keeperValidationErrorI18nKey(new KeeperAuthError(KeeperAuthErrorCode.MfaFailed, "failed")),
    ).toBe("multifactorAuthenticationFailed");
  });

  it("maps an unsupported two-factor method", () => {
    expect(
      keeperValidationErrorI18nKey(
        new KeeperAuthError(KeeperAuthErrorCode.UnsupportedTwoFactorMethod, "unsupported"),
      ),
    ).toBe("keeperUnsupported2faMethod");
  });

  it("maps a socket error", () => {
    expect(
      keeperValidationErrorI18nKey(new KeeperAuthError(KeeperAuthErrorCode.SocketError, "socket")),
    ).toBe("keeperConnectionError");
  });

  it("falls back to a generic error for a non-KeeperAuthError", () => {
    expect(keeperValidationErrorI18nKey(new Error("some other failure"))).toBe("errorOccurred");
  });

  it("falls back to a generic error for a non-Error value", () => {
    expect(keeperValidationErrorI18nKey("a plain string")).toBe("errorOccurred");
  });
});
