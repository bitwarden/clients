import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { PremiumSetupIntentService } from "@bitwarden/angular/billing/services/premium-setup-intent/premium-setup-intent-state.service.abstraction";
import { BILLING_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

export const PREMIUM_SETUP_INTENT_KEY = new UserKeyDefinition<boolean>(
  BILLING_MEMORY,
  "premiumSetupIntent",
  {
    deserializer: (value: boolean) => value,
    clearOn: ["lock", "logout"],
  },
);

@Injectable()
export class WebPremiumSetupIntentService implements PremiumSetupIntentService {
  constructor(private stateProvider: StateProvider) {}

  async getPremiumSetupIntent(userId: UserId): Promise<boolean | null> {
    if (!userId) {
      throw new Error("UserId is required. Cannot get 'premiumSetupIntent'.");
    }

    return await firstValueFrom(this.stateProvider.getUserState$(PREMIUM_SETUP_INTENT_KEY, userId));
  }

  async setPremiumSetupIntent(userId: UserId, premiumSetupIntent: boolean): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot set 'premiumSetupIntent'.");
    }

    await this.stateProvider.setUserState(PREMIUM_SETUP_INTENT_KEY, premiumSetupIntent, userId);
  }

  async clearPremiumSetupIntent(userId: UserId): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot clear 'premiumSetupIntent'.");
    }

    await this.stateProvider.setUserState(PREMIUM_SETUP_INTENT_KEY, null, userId);
  }
}
