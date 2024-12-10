// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import {
  ActiveUserState,
  StateProvider,
  UserKeyDefinition,
  VAULT_ONBOARDING,
} from "@bitwarden/common/platform/state";

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
  private vaultOnboardingState: ActiveUserState<VaultOnboardingTasks>;
  vaultOnboardingState$: Observable<VaultOnboardingTasks>;

  constructor(private stateProvider: StateProvider) {
    this.vaultOnboardingState = this.stateProvider.getActive(VAULT_ONBOARDING_KEY);
    this.vaultOnboardingState$ = this.vaultOnboardingState.state$;
  }

  async setVaultOnboardingTasks(newState: VaultOnboardingTasks): Promise<void> {
    await this.vaultOnboardingState.update(() => {
      return { ...newState };
    });
  }
}
