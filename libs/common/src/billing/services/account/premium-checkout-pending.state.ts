import { BILLING_MEMORY, UserKeyDefinition } from "@bitwarden/state";

/**
 * Memory-scoped, account-scoped flag indicating an external Stripe checkout was
 * launched and a return-sync is pending. Cleared on logout (and on app restart,
 * since the storage location is memory).
 */
export const PREMIUM_CHECKOUT_PENDING_KEY = new UserKeyDefinition<boolean>(
  BILLING_MEMORY,
  "premiumCheckoutPending",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
  },
);
