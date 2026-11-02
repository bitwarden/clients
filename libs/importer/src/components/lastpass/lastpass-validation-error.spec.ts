import { lastPassValidationErrorI18nKey } from "./lastpass-validation-error";

describe("lastPassValidationErrorI18nKey", () => {
  it.each([
    "SSO auth cancelled",
    "Second factor step is canceled by the user",
    "Out of band step is canceled by the user",
  ])("maps %s to multifactorAuthenticationCancelled", (message) => {
    expect(lastPassValidationErrorI18nKey(new Error(message))).toBe(
      "multifactorAuthenticationCancelled",
    );
  });

  it.each(["No accounts to transform", "Vault has not opened any accounts."])(
    "maps %s to noLastPassDataFound",
    (message) => {
      expect(lastPassValidationErrorI18nKey(new Error(message))).toBe("noLastPassDataFound");
    },
  );

  it.each(["Invalid username", "Invalid password"])(
    "maps %s to incorrectUsernameOrPassword",
    (message) => {
      expect(lastPassValidationErrorI18nKey(new Error(message))).toBe(
        "incorrectUsernameOrPassword",
      );
    },
  );

  it.each(["Second factor code is incorrect", "Out of band authentication failed"])(
    "maps %s to multifactorAuthenticationFailed",
    (message) => {
      expect(lastPassValidationErrorI18nKey(new Error(message))).toBe(
        "multifactorAuthenticationFailed",
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
    expect(lastPassValidationErrorI18nKey("Invalid password")).toBe("incorrectUsernameOrPassword");
  });
});
