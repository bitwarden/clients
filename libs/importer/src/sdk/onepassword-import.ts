import {
  Credentials as OnePasswordCredentials,
  OnePasswordImportSummary,
  OnePasswordSsoEnrollment,
  OnePasswordSsoEnrollmentResult,
  OnePasswordSsoEnrollmentStatus,
  OnePasswordSsoUi,
  OnePasswordTwoFactorUi,
  SignInAddress as OnePasswordSignInAddress,
  SignInDomain as OnePasswordSignInDomain,
  SignInMethods as OnePasswordSignInMethods,
  SsoCredentials as OnePasswordSsoCredentials,
  isImportError,
} from "@bitwarden/sdk-internal";

export {
  OnePasswordCredentials,
  OnePasswordImportSummary,
  OnePasswordSignInAddress,
  OnePasswordSignInDomain,
  OnePasswordSignInMethods,
  OnePasswordSsoCredentials,
  OnePasswordSsoEnrollment,
  OnePasswordSsoEnrollmentResult,
  OnePasswordSsoEnrollmentStatus,
  OnePasswordSsoUi,
  OnePasswordTwoFactorUi,
};

/** Everything a direct 1Password import needs from the caller. */
export interface OnePasswordImportRequest {
  credentials: OnePasswordCredentials;
  /** Asked for a passcode when the account has two-step verification enabled. */
  twoFactorUi: OnePasswordTwoFactorUi;
}

/** Everything a direct 1Password import with single sign-on needs from the caller. */
export interface OnePasswordSsoImportRequest {
  credentials: OnePasswordSsoCredentials;
  /** Takes the user through the identity provider login and the approval of a new device. */
  ui: OnePasswordSsoUi;
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
 * A field of the import form or the Secret Key and password prompt. `secretKeyAndPassword` is the
 * two together: 1Password checks them as one and cannot tell which is wrong.
 */
export type OnePasswordErrorField =
  "email" | "signInAddress" | "secretKey" | "secretKeyAndPassword";

/** How a failed 1Password import is shown. */
export interface OnePasswordErrorDisplay {
  /** The field the user can correct, shown with the message, or `undefined` for a toast. */
  field?: OnePasswordErrorField;
  /** The message's i18n key. */
  messageKey: string;
}

/**
 * Where and how to show a failed 1Password import, or `undefined` when the user canceled it and
 * there is nothing to show. What the user entered is marked on its field, except an email
 * 1Password refuses, which gets a toast of its own, as does a new device the user denied on another
 * one. Everything else, from a lost connection to a vault that could not be saved, is out of their
 * hands and shown as the same toast.
 */
export function onePasswordErrorDisplay(error: unknown): OnePasswordErrorDisplay | undefined {
  if (!isImportError(error)) {
    return { messageKey: "onePasswordImportError" };
  }
  switch (error.variant) {
    // 1Password refuses an unknown email, sign-in address or region the same way as a wrong
    // password or Secret Key.
    case "OnePasswordBadCredentials":
      return { field: "secretKeyAndPassword", messageKey: "onePasswordCheckCredentials" };
    case "OnePasswordInvalidSecretKey":
      return { field: "secretKey", messageKey: "enterValidSecretKey" };
    case "OnePasswordInvalidEmail":
      return { messageKey: "enterValidEmailOrUseDifferentImportMethod" };
    case "OnePasswordInvalidSignInAddress":
      return { field: "signInAddress", messageKey: "enterValidSignInAddress" };
    // A step of signing in to the account the importer cannot take, such as an unsupported
    // two-factor method.
    case "OnePasswordUnsupported":
      return { field: "email", messageKey: "onePasswordUnsupportedSignIn" };
    case "OnePasswordDenied":
      return { messageKey: "onePasswordSsoDeviceDenied" };
    case "OnePasswordCanceled":
      return undefined;
    default:
      return { messageKey: "onePasswordImportError" };
  }
}
