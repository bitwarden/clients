export abstract class LoginViaWebAuthnComponentService {
  /** Whether to show the page icons (the login with passkey page has two UI screens, each with its own icon). */
  abstract showPageIcons: boolean;

  /** Whether to show the "Trouble logging in?" text. */
  abstract showTroubleLoggingInText: boolean;

  /** Whether to left-align the descriptive text. */
  abstract leftAlignDescription: boolean;
}
