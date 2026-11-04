export abstract class LoginViaWebAuthnComponentService {
  /** Whether to show the "Trouble logging in?" text. */
  abstract showTroubleLoggingInText: boolean;

  /** Whether to left-align the descriptive text. */
  abstract leftAlignDescription: boolean;

  /**
   * If set, called with the email of the account that the server resolved the passkey to, before
   * the account is added, e.g. where another app could have returned the assertion. Logging in is
   * cancelled unless it resolves to `true`.
   */
  confirmAccount?(email: string): Promise<boolean>;
}
