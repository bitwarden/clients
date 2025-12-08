import { Observable } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { SignedSecurityState } from "../../types";
import { SecurityStateService } from "../abstractions/security-state.service";
import { ACCOUNT_SECURITY_STATE } from "../state/security-state.state";

export class DefaultSecurityStateService implements SecurityStateService {
  constructor(protected stateProvider: StateProvider) {}

  // Emits the provided user's security state, or null if there is no security state present for the user.
  accountSecurityState$(userId: UserId): Observable<SignedSecurityState | null> {
    return this.stateProvider.getUserState$(ACCOUNT_SECURITY_STATE, userId);
  }

  // Sets the security state for the provided user.
  // This is not yet validated, and is only validated upon SDK initialization.
  async setAccountSecurityState(
    accountSecurityState: SignedSecurityState,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.setUserState(ACCOUNT_SECURITY_STATE, accountSecurityState, userId);
  }
}
