import { Cart } from "@bitwarden/pricing";

import { Storage } from "./storage";

export const SubscriptionStatuses = {
  Incomplete: "incomplete",
  IncompleteExpired: "incomplete_expired",
  Trialing: "trialing",
  Active: "active",
  PastDue: "past_due",
  Canceled: "canceled",
  Unpaid: "unpaid",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatuses)[keyof typeof SubscriptionStatuses];

/**
 * A subscription projected from a Stripe invoice preview.
 *
 * `storage` is optional, because the server returns no storage for subscribers without a maximum
 * storage allowance.
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
