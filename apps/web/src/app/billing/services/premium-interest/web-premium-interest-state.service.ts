import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { BILLING_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

export const PREMIUM_INTEREST_KEY = new UserKeyDefinition<boolean>(
  BILLING_MEMORY,
  "premiumInterest",
  {
    deserializer: (value: boolean) => value,
    clearOn: ["lock", "logout"],
  },
);

@Injectable()
export class WebPremiumInterestStateService implements PremiumInterestStateService {
  constructor(private stateProvider: StateProvider) {}

  async getPremiumInterest(userId: UserId): Promise<boolean | null> {
    if (!userId) {
      throw new Error("UserId is required. Cannot get 'premiumInterest'.");
    }

    return await firstValueFrom(this.stateProvider.getUserState$(PREMIUM_INTEREST_KEY, userId));
  }

  async setPremiumInterest(userId: UserId, premiumInterest: boolean): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot set 'premiumInterest'.");
    }

    await this.stateProvider.setUserState(PREMIUM_INTEREST_KEY, premiumInterest, userId);
  }

  async clearPremiumInterest(userId: UserId): Promise<void> {
    if (!userId) {
      throw new Error("UserId is required. Cannot clear 'premiumInterest'.");
    }

    await this.stateProvider.setUserState(PREMIUM_INTEREST_KEY, null, userId);
  }
}
