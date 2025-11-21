import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { WrappedUserAccountCryptographicState } from "@bitwarden/sdk-internal";

export abstract class AccountCryptographicStateService {
  constructor() {}

  // Emits the provided user's security state, or null if there is no security state present for the user.
  abstract accountCryptographicState$(
    userId: UserId,
  ): Observable<WrappedUserAccountCryptographicState | null>;

  // Sets the security state for the provided user.
  // This is not yet validated, and is only validated upon SDK initialization.
  abstract setAccountCryptographicState(
    accountCryptographicState: WrappedUserAccountCryptographicState,
    userId: UserId,
  ): Promise<void>;
}
