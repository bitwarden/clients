/**
 * Service abstraction for unlock via WebAuthn/PRF.
 * Allows platform-specific implementations to handle passkey unlock differently.
 */
export abstract class UnlockViaWebAuthnComponentService {
  /**
   * Returns true when credentials.get() cannot be called directly in the current context
   * and must be relayed via the web vault connector page.
   */
  abstract shouldUseWebVaultRelay(): boolean;

  /**
   * Opens the web vault connector tab for relay-based passkey unlock.
   * Returns when the tab has been launched.
   */
  abstract openWebVaultRelayTab(): Promise<void>;
}

/**
 * Default implementation for platforms that support direct WebAuthn API calls.
 */
export class DefaultUnlockViaWebAuthnComponentService implements UnlockViaWebAuthnComponentService {
  shouldUseWebVaultRelay(): boolean {
    return false;
  }

  async openWebVaultRelayTab(): Promise<void> {
    throw new Error("Web vault relay is not supported on this platform.");
  }
}
