import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_ONBOARDING,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { VaultOnboardingService as VaultOnboardingServiceAbstraction } from "./abstraction/vault-onboarding.service";

export type VaultOnboardingTasks = {
  createAccount: boolean;
  importData: boolean;
  installExtension: boolean;
};

const VAULT_ONBOARDING_KEY = new UserKeyDefinition<VaultOnboardingTasks>(
  VAULT_ONBOARDING,
  "tasks",
  {
    deserializer: (jsonData) => jsonData,
    clearOn: [], // do not clear tutorials
  },
);
@Injectable()
export class VaultOnboardingService implements VaultOnboardingServiceAbstraction {
  constructor(private stateProvider: StateProvider) {}

  private vaultOnboardingState(userId: UserId): SingleUserState<VaultOnboardingTasks> {
    return this.stateProvider.getUser(userId, VAULT_ONBOARDING_KEY);
  }

  vaultOnboardingState$(userId: UserId): Observable<VaultOnboardingTasks | null> {
    return this.vaultOnboardingState(userId).state$;
  }

  async setVaultOnboardingTasks(userId: UserId, newState: VaultOnboardingTasks): Promise<void> {
    const state = this.vaultOnboardingState(userId);
    await state.update(() => ({ ...newState }));
  }
}
