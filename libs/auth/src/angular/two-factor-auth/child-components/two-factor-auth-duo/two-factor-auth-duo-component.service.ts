import { Observable } from "rxjs";

export interface Duo2faResult {
  code: string;
  state: string;
  /**
   * The code and the state joined by a | character.
   */
  token: string;
}

/**
 * A service which manages all the cross client logic for the duo 2FA component.
 */
export abstract class TwoFactorAuthDuoComponentService {
  /**
   * Retrieves the result of the duo two-factor authentication process.
   * @returns {Observable<Duo2faResult>} An observable that emits the result of the duo two-factor authentication process.
   */
  abstract listenForDuo2faResult$(): Observable<Duo2faResult>;

  /**
   * Launches the client specific duo frameless 2FA flow.
   */
  abstract launchDuoFrameless(duoFramelessUrl: string): Promise<void>;

  /**
   * Optionally launches the extension duo 2FA single action popout
   * Only applies to the extension today.
   */
  abstract openTwoFactorAuthDuoPopout?(): Promise<void>;
}
