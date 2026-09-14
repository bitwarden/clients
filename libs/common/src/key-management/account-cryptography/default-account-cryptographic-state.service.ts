import { Observable } from "rxjs";

import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { ACCOUNT_CRYPTOGRAPHIC_STATE } from "../state-definitions";

import { AccountCryptographicStateService } from "./account-cryptographic-state.service";

export class DefaultAccountCryptographicStateService implements AccountCryptographicStateService {
  constructor(protected stateProvider: StateProvider) {}

  accountCryptographicState$(userId: UserId): Observable<WrappedAccountCryptographicState | null> {
    return this.stateProvider.getUserState$(ACCOUNT_CRYPTOGRAPHIC_STATE, userId);
  }

  async setAccountCryptographicState(
    accountCryptographicState: WrappedAccountCryptographicState,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.setUserState(
      ACCOUNT_CRYPTOGRAPHIC_STATE,
      accountCryptographicState,
      userId,
    );
  }

  async clearAccountCryptographicState(userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(ACCOUNT_CRYPTOGRAPHIC_STATE, null, userId);
  }
}
