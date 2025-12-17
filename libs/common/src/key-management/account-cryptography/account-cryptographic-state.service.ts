import { Observable } from "rxjs";

import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

export abstract class AccountCryptographicStateService {
  /**
   * Emits the provided user's account cryptographic state or null if there is no account cryptographic state present for the user.
   */
  abstract accountCryptographicState$(
    userId: UserId,
  ): Observable<WrappedAccountCryptographicState | null>;

  /**
   * Sets the account cryptographic state.
   * This is not yet validated, and is only validated upon SDK initialization.
   */
  abstract setAccountCryptographicState(
    accountCryptographicState: WrappedAccountCryptographicState,
    userId: UserId,
  ): Promise<void>;
}
