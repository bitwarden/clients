import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { BILLING_DISK_LOCAL, StateProvider, UserKeyDefinition } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

export const INTENT_TO_SETUP_PREMIUM_KEY = new UserKeyDefinition<boolean>(
  BILLING_DISK_LOCAL,
  "intentToSetupPremium",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

@Injectable({
  providedIn: "root",
})
export class SetupPremiumService {
  constructor(private stateProvider: StateProvider) {}

  async setIntentToSetupPremium(intent: boolean, userId: UserId) {
    await this.stateProvider.setUserState(INTENT_TO_SETUP_PREMIUM_KEY, intent, userId);
  }

  async getIntentToSetupPremium(userId: UserId) {
    await firstValueFrom(this.stateProvider.getUserState$(INTENT_TO_SETUP_PREMIUM_KEY, userId));
  }

  async clearIntentToSetupPremium(userId: UserId) {
    await this.stateProvider.setUserState(INTENT_TO_SETUP_PREMIUM_KEY, null, userId);
  }
}
