/** Maps a LastPass login failure to its inline-error i18n key. Pure, so it's testable standalone. */
export function lastPassValidationErrorI18nKey(error: unknown): string {
  const message = typeof error === "string" ? error : (error as Error)?.message;
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
