import { ImportError, isImportError } from "@bitwarden/sdk-internal";

import { onePasswordErrorLogName, onePasswordErrorMessageKey } from "./onepassword-import";

// `isImportError` is a WASM call; override just it so the error mapping is unit-testable.
jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isImportError: jest.fn(),
}));

const isImportErrorMock = jest.mocked(isImportError);

function importError(variant: ImportError["variant"], message = ""): ImportError {
  isImportErrorMock.mockReturnValue(true);
  return Object.assign(new Error(message), { name: "ImportError" as const, variant });
}

function otherError<T>(error: T): T {
  isImportErrorMock.mockReturnValue(false);
  return error;
}

describe("onePasswordErrorMessageKey", () => {
  it.each<[ImportError["variant"], string]>([
    ["OnePasswordBadCredentials", "incorrectSignInAddressEmailPasswordOrSecretKey"],
    ["OnePasswordInvalidSignInAddress", "invalidSignInAddress"],
    ["OnePasswordInvalidSecretKey", "invalidSecretKey"],
    ["OnePasswordTwoFactorRequired", "multifactorAuthenticationFailed"],
    ["OnePasswordTwoFactorFailed", "multifactorAuthenticationFailed"],
    ["OnePasswordUnsupported", "onePasswordUnsupportedAccount"],
    ["OnePasswordNetwork", "onePasswordImportFailed"],
    ["OnePasswordDecryption", "onePasswordDecryptionFailed"],
    ["Api", "onePasswordVaultSaveFailed"],
    ["NotAuthenticated", "onePasswordVaultSaveFailed"],
    ["BitwardenCrypto", "onePasswordVaultSaveFailed"],
    ["Export", "onePasswordVaultSaveFailed"],
  ])("describes %s with %s", (variant, key) => {
    expect(onePasswordErrorMessageKey(importError(variant))).toBe(key);
  });

  it("leaves another importer's failure to the generic message", () => {
    expect(onePasswordErrorMessageKey(importError("KdbxWrongCredentials"))).toBeUndefined();
  });

  it("leaves an error that did not come from the SDK to the generic message", () => {
    expect(onePasswordErrorMessageKey(otherError(new Error("failed")))).toBeUndefined();
  });
});

describe("onePasswordErrorLogName", () => {
  it("names an SDK failure by its variant rather than its message", () => {
    const error = importError(
      "OnePasswordUnsupported",
      "no password login method found for account user@example.com",
    );

    expect(onePasswordErrorLogName(error)).toBe("OnePasswordUnsupported");
  });

  it("names any other error by its name", () => {
    expect(onePasswordErrorLogName(otherError(new TypeError("user@example.com")))).toBe(
      "TypeError",
    );
  });

  it("names a thrown value that is not an error as unknown", () => {
    expect(onePasswordErrorLogName(otherError("user@example.com"))).toBe("unknown");
  });
});
