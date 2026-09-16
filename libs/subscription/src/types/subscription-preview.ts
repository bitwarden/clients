import { Cart } from "@bitwarden/pricing";

import { Storage } from "./storage";

/**
 * The preview-driven counterpart to `BitwardenSubscription`, projected from a Stripe invoice
 * preview rather than the legacy subscription response.
 *
 * One deliberate difference from `BitwardenSubscription`: `storage` is optional, because the
 * server returns no storage for subscribers without a maximum storage allowance.
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
  /**
   * Optional because `past_due`/`unpaid` responses legitimately omit suspension details: the
   * server derives them from the subscription's open overdue invoices and returns nothing when
   * none qualify (e.g. the invoice was paid or voided before the status webhook landed). For
   * `incomplete`/`incomplete_expired` the server always emits them, and the response layer
   * enforces that at parse. Consumers render without a suspension notice when absent.
   */
  suspension?: Date;
  gracePeriod?: number;
};

type Billable = {
  status: "trialing" | "active";
  nextCharge: Date;
  cancelAt?: Date;
};

type Canceled = {
  status: "canceled";
  canceled: Date;
};

export type SubscriptionPreview = HasCart & HasStorage & (Suspension | Billable | Canceled);
