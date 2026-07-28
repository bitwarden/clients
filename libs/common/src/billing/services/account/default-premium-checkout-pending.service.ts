import { StateProvider } from "@bitwarden/state";

import { UserId } from "../../../types/guid";
import { PremiumCheckoutPendingService } from "../../abstractions/account/premium-checkout-pending.service";

import { PREMIUM_CHECKOUT_PENDING_KEY } from "./premium-checkout-pending.state";

export class DefaultPremiumCheckoutPendingService implements PremiumCheckoutPendingService {
  constructor(private readonly stateProvider: StateProvider) {}

  async markCheckoutLaunched(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, PREMIUM_CHECKOUT_PENDING_KEY).update(() => true);
  }

  async consumeCheckoutPending(userId: UserId): Promise<boolean> {
    let wasPending = false;
    await this.stateProvider.getUser(userId, PREMIUM_CHECKOUT_PENDING_KEY).update((current) => {
      wasPending = current === true;
      return false;
    });
    return wasPending;
  }
}
