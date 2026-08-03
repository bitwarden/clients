import { Cart, InvoicePreview } from "@bitwarden/pricing";
import {
  Storage,
  SubscriptionPreview,
  SubscriptionStatus,
  SubscriptionStatuses,
} from "@bitwarden/subscription";

import { BaseResponse } from "../../../models/response/base.response";

import { InvoicePreviewResponse } from "./invoice-preview.response";
import { StorageResponse } from "./storage.response";

const parseDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? undefined : date;
};

export class SubscriptionPreviewResponse extends BaseResponse {
  status: SubscriptionStatus;
  cart: InvoicePreview;
  storage?: Storage;
  cancelAt?: Date;
  canceled?: Date;
  suspension?: Date;
  gracePeriod?: number;

  constructor(response: any) {
    super(response);

    const status = this.getResponseProperty("Status");
    if (
      status !== SubscriptionStatuses.Incomplete &&
      status !== SubscriptionStatuses.IncompleteExpired &&
      status !== SubscriptionStatuses.Trialing &&
      status !== SubscriptionStatuses.Active &&
      status !== SubscriptionStatuses.PastDue &&
      status !== SubscriptionStatuses.Canceled &&
      status !== SubscriptionStatuses.Unpaid
    ) {
      throw new Error(`Failed to parse invalid subscription status: ${status}`);
    }
    this.status = status;

    this.cart = new InvoicePreviewResponse(this.getResponseProperty("Cart"));

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
      (this.status === SubscriptionStatuses.Incomplete ||
        this.status === SubscriptionStatuses.IncompleteExpired) &&
      (this.suspension == null || this.gracePeriod == null)
    ) {
      throw new Error(
        `Failed to parse missing suspension details for subscription status: ${this.status}`,
      );
    }
    if (this.status === SubscriptionStatuses.Canceled && this.canceled == null) {
      throw new Error("Failed to parse missing canceled date for canceled subscription");
    }
  }

  /**
   * Assembles the status union around an already-adapted cart.
   *
   * The cart is a parameter rather than being derived here because adapting a `InvoicePreview` into a
   * render-ready `Cart` needs a flow context and a logger, both of which belong to the facade.
   * The facade adapts `this.cart` first, then passes the result in.
   *
   * The `canceled!` assertion is safe: the constructor throws when a canceled response lacks
   * the date. Suspension details pass through as-is — they are optional on the suspension arm
   * because `past_due`/`unpaid` responses legitimately omit them.
   */
  toDomain = (cart: Cart): SubscriptionPreview => {
    switch (this.status) {
      case SubscriptionStatuses.Incomplete:
      case SubscriptionStatuses.IncompleteExpired:
      case SubscriptionStatuses.PastDue:
      case SubscriptionStatuses.Unpaid: {
        return {
          cart,
          storage: this.storage,
          status: this.status,
          suspension: this.suspension,
          gracePeriod: this.gracePeriod,
        };
      }
      case SubscriptionStatuses.Trialing:
      case SubscriptionStatuses.Active: {
        return {
          cart,
          storage: this.storage,
          status: this.status,
          cancelAt: this.cancelAt,
        };
      }
      case SubscriptionStatuses.Canceled: {
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
