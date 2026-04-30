export abstract class LoginViaWebAuthnComponentService {
  /** Whether to show the page icons (the login with passkey page has two UI screens, each with its own icon). */
  abstract showPageIcons: boolean;

  /** Whether to show the "Trouble logging in?" text. */
  abstract showTroubleLoggingInText: boolean;

  /** The link text for navigating away from passkey login. */
  abstract useDifferentLoginMethodLinkText: string;
}
