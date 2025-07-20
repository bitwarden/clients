/**
 * Service to capture TOTP secret from a client application.
 */
export abstract class TotpCaptureService {
  /**
   * Captures a TOTP secret and returns it as a string. Returns null if no TOTP secret was found.
   */
  abstract captureTotpSecret(): Promise<string | null>;
  /**
   * Returns whether the TOTP secret can be captured from the current tab.
   * Only available in the browser extension and when not in a popout window.
   */
  abstract canCaptureTotp(window: Window): boolean;
}
