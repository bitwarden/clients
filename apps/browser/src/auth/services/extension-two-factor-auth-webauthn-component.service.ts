import {
  DefaultTwoFactorAuthWebAuthnComponentService,
  TwoFactorAuthWebAuthnComponentService,
} from "@bitwarden/auth/angular";

export class ExtensionTwoFactorAuthWebAuthnComponentService
  extends DefaultTwoFactorAuthWebAuthnComponentService
  implements TwoFactorAuthWebAuthnComponentService
{
  /**
   * In the browser extension, we open webAuthn in a new web client tab due to inline
   * WebAuthn Iframe's not working due "WebAuthn is not supported on sites with TLS certificate errors".
   * We open a 2FA popout upon successful completion of WebAuthn submission with query parameters to finish the 2FA process.
   * @returns boolean
   */
  shouldOpenWebAuthnInNewTab(): boolean {
    return true;
  }
}
