import { Injectable } from "@angular/core";

import { UserId } from "@bitwarden/user-core";

import { PremiumSetupIntentService } from "./premium-setup-intent-state.service.abstraction";

@Injectable()
export class NoopPremiumSetupIntentService implements PremiumSetupIntentService {
  async getPremiumSetupIntent(userId: UserId): Promise<boolean | null> {
    return null;
  } // no-op
  async setPremiumSetupIntent(userId: UserId, premiumSetupIntent: boolean): Promise<void> {} // no-op
  async clearPremiumSetupIntent(userId: UserId): Promise<void> {} // no-op
}
