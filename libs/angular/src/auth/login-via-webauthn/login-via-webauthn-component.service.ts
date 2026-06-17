export abstract class LoginViaWebAuthnComponentService {
  /** Whether to show the "Trouble logging in?" text. */
  abstract showTroubleLoggingInText: boolean;

  /** Whether to left-align the descriptive text. */
  abstract leftAlignDescription: boolean;
}
