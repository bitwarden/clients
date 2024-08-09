/**
 * TODO: PM-10727 - Rename and Refactor this service
 * This service is being used in both CipherForm and CipherView. Update this service to reflect that
 */

/**
 * Service to capture TOTP secret from a client application.
 */
export abstract class TotpCaptureService {
  /**
   * Captures a TOTP secret and returns it as a string. Returns null if no TOTP secret was found.
   */
  abstract captureTotpSecret(): Promise<string | null>;
  abstract openAutofillNewTab(loginUri: string): void;
}
