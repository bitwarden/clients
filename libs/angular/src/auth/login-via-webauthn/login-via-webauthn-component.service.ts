import { Translation } from "@bitwarden/components";

export abstract class LoginViaWebAuthnComponentService {
  /** When false, the page icon is hidden on the passkey login page. */
  abstract shouldShowPageIcon: boolean;

  /** When false, the "Trouble logging in?" label is hidden. */
  abstract shouldShowTroubleLoggingInText: boolean;

  /** The link text for switching away from passkey login. */
  abstract useDifferentLoginMethodLinkText: string | Translation;
}
