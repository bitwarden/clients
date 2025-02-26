/**
 * A service that manages all cross client functionality for the WebAuthn 2FA component.
 */
export abstract class TwoFactorAuthWebAuthnComponentService {
  /**
   * Determines if the WebAuthn 2FA should be opened in a new tab or can be completed in the current tab.
   * In a browser extension context, we open WebAuthn in a new web client tab.
   */
  abstract shouldOpenWebAuthnInNewTab(): boolean;
}
