import { ImportError, isImportError } from "@bitwarden/sdk-internal";

import {
  OnePasswordErrorDisplay,
  onePasswordErrorDisplay,
  onePasswordErrorLogName,
} from "./onepassword-import";

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

describe("onePasswordErrorDisplay", () => {
  it.each<[ImportError["variant"], OnePasswordErrorDisplay]>([
    [
      "OnePasswordBadCredentials",
      { field: "password", messageKey: "onePasswordIncorrectUsernameOrPassword" },
    ],
    ["OnePasswordInvalidSecretKey", { field: "secretKey", messageKey: "enterValidSecretKey" }],
    [
      "OnePasswordInvalidSignInAddress",
      { field: "signInAddress", messageKey: "enterValidSignInAddress" },
    ],
    [
      "OnePasswordUnsupported",
      { field: "email", messageKey: "onePasswordOnlyPasswordLoginTryAgain" },
    ],
  ])("marks %s on the field the user can correct", (variant, display) => {
    expect(onePasswordErrorDisplay(importError(variant))).toEqual(display);
  });

  it("shows any other SDK failure in a toast", () => {
    expect(onePasswordErrorDisplay(importError("OnePasswordNetwork"))).toEqual({
      messageKey: "onePasswordImportError",
    });
  });

  it("shows an error that did not come from the SDK in a toast", () => {
    expect(onePasswordErrorDisplay(otherError(new Error("failed")))).toEqual({
      messageKey: "onePasswordImportError",
    });
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
});
