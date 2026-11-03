/**
 * A service that manages all cross client functionality for the WebAuthn 2FA component.
 */
export abstract class TwoFactorAuthWebAuthnComponentService {
  /**
   * Determines if the WebAuthn 2FA should be opened in a new tab or can be completed in the current tab.
   * In a browser extension context, we open WebAuthn in a new web client tab.
   */
  abstract shouldOpenWebAuthnInNewTab(): boolean;

  /**
   * Determines if WebAuthn 2FA is completed in the current window with `navigator.credentials`,
   * rather than in the web vault's WebAuthn connector. This is only possible where the window's
   * `navigator.credentials` can make requests for the web vault, like the desktop app on Windows.
   */
  abstract shouldAuthenticateInWindow(): Promise<boolean>;

  /**
   * Completes WebAuthn 2FA in the current window. Only used if {@link shouldAuthenticateInWindow}
   * returns true.
   *
   * @param options The assertion options from the WebAuthn 2FA provider data.
   * @param win The window whose `navigator.credentials` is used.
   * @returns The token to submit for two-factor authentication.
   */
  abstract authenticateInWindow(
    options: PublicKeyCredentialRequestOptions,
    win: Window,
  ): Promise<string>;
}
