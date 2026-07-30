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

    const suspension = this.getResponseProperty("Suspension");
    if (suspension) {
      this.suspension = new Date(suspension);
    }

    const gracePeriod = this.getResponseProperty("GracePeriod");
    if (gracePeriod) {
      this.gracePeriod = gracePeriod;
    }

    const cancelAt = this.getResponseProperty("CancelAt");
    if (cancelAt) {
      this.cancelAt = new Date(cancelAt);
    }

    const canceled = this.getResponseProperty("Canceled");
    if (canceled) {
      this.canceled = new Date(canceled);
    }
  }

  /**
   * Assembles the status union around an already-adapted cart.
   *
   * The cart is a parameter rather than being derived here because adapting a `InvoicePreview` into a
   * render-ready `Cart` needs a flow context and a logger, both of which belong to the facade.
   * The facade adapts `this.cart` first, then passes the result in.
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
          suspension: this.suspension!,
          gracePeriod: this.gracePeriod!,
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
