/**
 * A service that manages all cross client functionality for the email 2FA component.
 */
export abstract class TwoFactorAuthEmailComponentService {
  /**
   * Optionally shows a warning to the user that they might need to popout the
   * window to complete email 2FA.
   */
  abstract openPopoutIfApprovedForEmail2fa?(): Promise<void>;
}
