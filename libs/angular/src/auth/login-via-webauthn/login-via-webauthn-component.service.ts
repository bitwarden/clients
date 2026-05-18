export abstract class LoginViaWebAuthnComponentService {
  /** The client-specific success route after WebAuthn authentication. */
  abstract successRoute: string;

  /**
   * Optionally handles post-authentication logic before route navigation.
   * Returns true if the service handled navigation (component must not navigate).
   * Used by: Browser extension (popout auto-close behavior)
   */
  handleSuccessfulAuthentication?: (shouldAutoClosePopout: boolean) => Promise<boolean>;
}
