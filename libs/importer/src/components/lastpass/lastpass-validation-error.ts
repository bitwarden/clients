/** The LastPass client throws plain strings for login failures and Errors for the rest. */
export function lastPassErrorMessage(error: unknown): string | undefined {
  return typeof error === "string" ? error : (error as Error)?.message;
}

/** Maps a LastPass login failure to its inline-error i18n key. Pure, so it's testable standalone. */
export function lastPassValidationErrorI18nKey(error: unknown): string {
  const message = lastPassErrorMessage(error);
  switch (message) {
    case "SSO auth cancelled":
    case "Second factor step is canceled by the user":
    case "Out of band step is canceled by the user":
      return "multifactorAuthenticationCancelled";
    case "No accounts to transform":
    case "Vault has not opened any accounts.":
      return "noLastPassDataFound";
    case "Invalid username":
    case "Invalid password":
      return "incorrectUsernameOrPassword";
    case "Second factor code is incorrect":
    case "Out of band authentication failed":
      return "multifactorAuthenticationFailed";
    case "unifiedloginresult":
      return "lastPassTryAgainCheckEmail";
    default:
      return "errorOccurred";
  }
}
