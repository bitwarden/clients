import { Observable } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";

import { SecurityStateService } from "../abstractions/security-state.service";
import { SerializedSecurityState } from "../models/security-state";
import { ACCOUNT_SECURITY_STATE } from "../state/account-security-state.state";

export class DefaultSecurityStateService implements SecurityStateService {
  readonly activeUserOrgKeys$: Observable<Record<OrganizationId, OrgKey>>;

  constructor(protected stateProvider: StateProvider) {}

  // Emits the provided user's security state, or null if there is no security state present for the user.
  accountSecurityState$(userId: UserId): Observable<SerializedSecurityState | null> {
    return this.stateProvider.getUserState$(ACCOUNT_SECURITY_STATE, userId);
  }

  // Sets the security state for the provided user.
  // This is not yet validated, and is only validated upon SDK initialization.
  async setAccountSecurityState(
    accountSecurityState: SerializedSecurityState,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.setUserState(ACCOUNT_SECURITY_STATE, accountSecurityState, userId);
  }
}
