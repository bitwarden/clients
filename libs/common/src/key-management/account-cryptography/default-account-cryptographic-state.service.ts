import { Observable } from "rxjs";

import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";
import { CRYPTO_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { AccountCryptographicStateService } from "./account-cryptographic-state.service";

export const ACCOUNT_CRYPTOGRAPHIC_STATE = new UserKeyDefinition<WrappedAccountCryptographicState>(
  CRYPTO_DISK,
  "accountCryptographicState",
  {
    deserializer: (obj) => obj as WrappedAccountCryptographicState,
    clearOn: ["logout"],
  },
);

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
}
