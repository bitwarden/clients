import { TwoFactorAuthWebAuthnComponentService } from "./two-factor-auth-webauthn-component.service";

export class DefaultTwoFactorAuthWebAuthnComponentService
  implements TwoFactorAuthWebAuthnComponentService
{
  /**
   * Default implementation is to not open in a new tab.
   */
  shouldOpenWebAuthnInNewTab(): boolean {
    return false;
  }
}
