import type { Cart, InvoicePreview } from "@bitwarden/pricing";
import type { Storage, SubscriptionPreview, SubscriptionStatus } from "@bitwarden/subscription";

import { BaseResponse } from "../../../models/response/base.response";

import { InvoicePreviewResponse } from "./invoice-preview.response";
import { StorageResponse } from "./storage.response";

const Incomplete = "incomplete" satisfies SubscriptionStatus;
const IncompleteExpired = "incomplete_expired" satisfies SubscriptionStatus;
const Trialing = "trialing" satisfies SubscriptionStatus;
const Active = "active" satisfies SubscriptionStatus;
const PastDue = "past_due" satisfies SubscriptionStatus;
const Canceled = "canceled" satisfies SubscriptionStatus;
const Unpaid = "unpaid" satisfies SubscriptionStatus;

const parseDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? undefined : date;
};

export class SubscriptionPreviewResponse extends BaseResponse {
  status: SubscriptionStatus;
  invoicePreview: InvoicePreview;
  storage?: Storage;
  cancelAt?: Date;
  canceled?: Date;
  suspension?: Date;
  gracePeriod?: number;

  constructor(response: any) {
    super(response);

    const status = this.getResponseProperty("Status");
    if (
      status !== Incomplete &&
      status !== IncompleteExpired &&
      status !== Trialing &&
      status !== Active &&
      status !== PastDue &&
      status !== Canceled &&
      status !== Unpaid
    ) {
      throw new Error(`Failed to parse invalid subscription status: ${status}`);
    }
    this.status = status;

    this.invoicePreview = new InvoicePreviewResponse(this.getResponseProperty("InvoicePreview"));

    // Optional: the server returns no storage for subscribers without a maximum storage allowance.
    const storage = this.getResponseProperty("Storage");
    if (storage) {
      this.storage = new StorageResponse(storage);
    }

    this.suspension = parseDate(this.getResponseProperty("Suspension"));

    // `!= null` rather than truthy: a grace period of zero means "suspends today", not "absent".
    const gracePeriod = this.getResponseProperty("GracePeriod");
    if (gracePeriod != null) {
      this.gracePeriod = gracePeriod;
    }

    this.cancelAt = parseDate(this.getResponseProperty("CancelAt"));

    this.canceled = parseDate(this.getResponseProperty("Canceled"));

    if (
      (this.status === Incomplete || this.status === IncompleteExpired) &&
      (this.suspension == null || this.gracePeriod == null)
    ) {
      throw new Error(
        `Failed to parse missing suspension details for subscription status: ${this.status}`,
      );
    }
    if (this.status === Canceled && this.canceled == null) {
      throw new Error("Failed to parse missing canceled date for canceled subscription");
    }
    if (
      (this.status === Trialing || this.status === Active) &&
      this.invoicePreview.nextPaymentAttempt == null
    ) {
      throw new Error(
        `Failed to parse missing next payment attempt for subscription status: ${this.status}`,
      );
    }
  }

  /**
   * Assembles the status union around an already-adapted cart.
   *
   * The cart is a parameter rather than being derived here because adapting a `InvoicePreview` into a
   * render-ready `Cart` needs a flow context and a logger, both of which belong to the facade.
   * The facade adapts `this.invoicePreview` first, then passes the result in.
   *
   * The `canceled!` and `nextPaymentAttempt!` assertions are safe: the constructor throws when a
   * canceled response lacks the date, and when a trialing/active response lacks the next payment
   * attempt. Suspension details pass through as-is — they are optional on the suspension arm
   * because `past_due`/`unpaid` responses legitimately omit them.
   */
  toDomain = (cart: Cart): SubscriptionPreview => {
    switch (this.status) {
      case Incomplete:
      case IncompleteExpired:
      case PastDue:
      case Unpaid: {
        return {
          cart,
          storage: this.storage,
          status: this.status,
          suspension: this.suspension,
          gracePeriod: this.gracePeriod,
        };
      }
      case Trialing:
      case Active: {
        return {
          cart,
          storage: this.storage,
          status: this.status,
          nextCharge: this.invoicePreview.nextPaymentAttempt!,
          cancelAt: this.cancelAt,
        };
      }
      case Canceled: {
        return {
          cart,
          storage: this.storage,
          status: this.status,
          canceled: this.canceled!,
        };
      }
    }
  };
}
