import { firstValueFrom } from "rxjs";

import { StateProvider } from "@bitwarden/state";

import { UserId } from "../../../types/guid";
import {
  PremiumCheckoutPending,
  PremiumCheckoutPendingService,
} from "../../abstractions/account/premium-checkout-pending.service";

import { PREMIUM_CHECKOUT_PENDING_KEY } from "./premium-checkout-pending.state";

export class DefaultPremiumCheckoutPendingService implements PremiumCheckoutPendingService {
  constructor(private readonly stateProvider: StateProvider) {}

  async markCheckoutLaunched(userId: UserId, context?: PremiumCheckoutPending): Promise<void> {
    await this.stateProvider
      .getUser(userId, PREMIUM_CHECKOUT_PENDING_KEY)
      .update(() => ({ ...context }));
  }

  async getCheckoutPending(userId: UserId): Promise<PremiumCheckoutPending | null> {
    const pending = await firstValueFrom(
      this.stateProvider.getUser(userId, PREMIUM_CHECKOUT_PENDING_KEY).state$,
    );
    return pending ?? null;
  }

  async clearCheckoutPending(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, PREMIUM_CHECKOUT_PENDING_KEY).update(() => null);
  }

  async consumeCheckoutPending(userId: UserId): Promise<PremiumCheckoutPending | null> {
    let pending: PremiumCheckoutPending | null = null;
    await this.stateProvider.getUser(userId, PREMIUM_CHECKOUT_PENDING_KEY).update((current) => {
      pending = current ?? null;
      return null;
    });
    return pending;
  }
}
