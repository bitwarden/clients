import { TwoFactorAuthWebAuthnComponentService } from "./two-factor-auth-webauthn-component.service";

export class DefaultTwoFactorAuthWebAuthnComponentService implements TwoFactorAuthWebAuthnComponentService {
  /**
   * Default implementation is to not open in a new tab.
   */
  shouldOpenWebAuthnInNewTab(): boolean {
    return false;
  }

  /**
   * Default implementation is to use the web vault's WebAuthn connector.
   */
  shouldAuthenticateInWindow(): Promise<boolean> {
    return Promise.resolve(false);
  }

  authenticateInWindow(_options: PublicKeyCredentialRequestOptions, _win: Window): Promise<string> {
    return Promise.reject(new Error("WebAuthn 2FA in the current window is not supported."));
  }
}
