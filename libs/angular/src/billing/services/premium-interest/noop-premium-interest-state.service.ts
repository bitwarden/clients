import { Injectable } from "@angular/core";

import { UserId } from "@bitwarden/user-core";

import { PremiumInterestStateService } from "./premium-interest-state.service.abstraction";

@Injectable()
export class NoopPremiumInterestStateService implements PremiumInterestStateService {
  async getPremiumInterest(userId: UserId): Promise<boolean | null> {
    return null;
  } // no-op
  async setPremiumInterest(userId: UserId, premiumInterest: boolean): Promise<void> {} // no-op
  async clearPremiumInterest(userId: UserId): Promise<void> {} // no-op
}
