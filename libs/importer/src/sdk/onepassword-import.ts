import {
  Credentials as OnePasswordCredentials,
  OnePasswordImportSummary,
  OnePasswordTwoFactorUi,
  SignInDomain as OnePasswordSignInDomain,
  isImportError,
} from "@bitwarden/sdk-internal";

export {
  OnePasswordCredentials,
  OnePasswordImportSummary,
  OnePasswordSignInDomain,
  OnePasswordTwoFactorUi,
};

/** Everything a direct 1Password import needs from the caller. */
export interface OnePasswordImportRequest {
  credentials: OnePasswordCredentials;
  /** Asked for a passcode when the account has two-step verification enabled. */
  twoFactorUi: OnePasswordTwoFactorUi;
}

/**
 * Names a failed 1Password import for the log: the SDK variant, which carries no account data, or
 * the error's name for anything else. The message is left out because it can embed the account's
 * address.
 */
export function onePasswordErrorLogName(error: unknown): string {
  if (isImportError(error)) {
    return error.variant;
  }
  return error instanceof Error ? error.name : "unknown";
}

/**
 * The i18n key describing a failed 1Password import, or `undefined` when the error is not one of the
 * SDK's 1Password failures.
 */
export function onePasswordErrorMessageKey(error: unknown): string | undefined {
  if (!isImportError(error)) {
    return undefined;
  }
  switch (error.variant) {
    case "OnePasswordBadCredentials":
      return "incorrectSignInAddressEmailPasswordOrSecretKey";
    case "OnePasswordInvalidSignInAddress":
      return "invalidSignInAddress";
    case "OnePasswordInvalidSecretKey":
      return "invalidSecretKey";
    case "OnePasswordTwoFactorRequired":
    case "OnePasswordTwoFactorFailed":
      return "multifactorAuthenticationFailed";
    case "OnePasswordUnsupported":
      return "onePasswordUnsupportedAccount";
    // Besides transport failures, this also covers responses the SDK did not expect.
    case "OnePasswordNetwork":
      return "onePasswordImportFailed";
    case "OnePasswordDecryption":
      return "onePasswordDecryptionFailed";
    // The account left 1Password intact; storing it in the vault is what failed.
    case "Api":
    case "NotAuthenticated":
    case "BitwardenCrypto":
    case "Export":
      return "onePasswordVaultSaveFailed";
    default:
      return undefined;
  }
}

/**
 * Whether a failed import was refused over the password or Secret Key, which the user can correct
 * by entering them again.
 */
export function isOnePasswordCredentialError(error: unknown): boolean {
  return (
    isImportError(error) &&
    (error.variant === "OnePasswordBadCredentials" ||
      error.variant === "OnePasswordInvalidSecretKey")
  );
}
