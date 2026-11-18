import { BILLING_MEMORY, UserKeyDefinition } from "@bitwarden/state";

import { PremiumCheckoutPending } from "../../abstractions/account/premium-checkout-pending.service";

/**
 * Memory-scoped, account-scoped record that an external Stripe checkout was
 * launched and a return-sync is pending. Cleared on logout (and on app restart,
 * since the storage location is memory).
 */
export const PREMIUM_CHECKOUT_PENDING_KEY = new UserKeyDefinition<PremiumCheckoutPending | null>(
  BILLING_MEMORY,
  "premiumCheckoutPending",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
  },
);
