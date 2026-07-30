import { Cart } from "@bitwarden/pricing";

import { Storage } from "./storage";

/**
 * The preview-driven counterpart to `BitwardenSubscription`, projected from a Stripe invoice
 * preview rather than the legacy subscription response.
 *
 * Two deliberate differences from `BitwardenSubscription`:
 * - `storage` is optional, because the server returns no storage for subscribers without a
 *   maximum storage allowance.
 * - There is no `nextCharge`; the billing-period boundary lives on `InvoicePreview.nextPaymentAttempt`.
 */

type HasCart = {
  /**
   * The render-ready cart. The facade adapts the raw `InvoicePreview` before constructing this type,
   * so components receive data they can bind straight to `<billing-cart-summary>`.
   */
  cart: Cart;
};

type HasStorage = {
  storage?: Storage;
};

type Suspension = {
  status: "incomplete" | "incomplete_expired" | "past_due" | "unpaid";
  suspension: Date;
  gracePeriod: number;
};

type Billable = {
  status: "trialing" | "active";
  cancelAt?: Date;
};

type Canceled = {
  status: "canceled";
  canceled: Date;
};

export type SubscriptionPreview = HasCart & HasStorage & (Suspension | Billable | Canceled);
