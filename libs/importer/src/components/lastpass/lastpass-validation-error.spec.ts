import { lastPassValidationErrorI18nKey } from "./lastpass-validation-error";

describe("lastPassValidationErrorI18nKey", () => {
  it.each([
    "SSO auth cancelled",
    "Second factor step is canceled by the user",
    "Out of band step is canceled by the user",
  ])("maps %s to multifactorAuthenticationCancelledV2", (message) => {
    expect(lastPassValidationErrorI18nKey(new Error(message))).toBe(
      "multifactorAuthenticationCancelledV2",
    );
  });

  it.each(["No accounts to transform", "Vault has not opened any accounts."])(
    "maps %s to noLastPassDataFoundV2",
    (message) => {
      expect(lastPassValidationErrorI18nKey(new Error(message))).toBe("noLastPassDataFoundV2");
    },
  );

  it.each(["Invalid username", "Invalid password"])(
    "maps %s to incorrectUsernameOrPasswordV2",
    (message) => {
      expect(lastPassValidationErrorI18nKey(new Error(message))).toBe(
        "incorrectUsernameOrPasswordV2",
      );
    },
  );

  it.each(["Second factor code is incorrect", "Out of band authentication failed"])(
    "maps %s to multifactorAuthenticationFailedV2",
    (message) => {
      expect(lastPassValidationErrorI18nKey(new Error(message))).toBe(
        "multifactorAuthenticationFailedV2",
      );
    },
  );

  it("maps unifiedloginresult to lastPassTryAgainCheckEmail", () => {
    expect(lastPassValidationErrorI18nKey(new Error("unifiedloginresult"))).toBe(
      "lastPassTryAgainCheckEmail",
    );
  });

  it("falls back to a generic error for an unrecognized message", () => {
    expect(lastPassValidationErrorI18nKey(new Error("something unexpected"))).toBe("errorOccurred");
  });

  it("accepts a plain string error, not just an Error object", () => {
    expect(lastPassValidationErrorI18nKey("Invalid password")).toBe(
      "incorrectUsernameOrPasswordV2",
    );
  });
});
