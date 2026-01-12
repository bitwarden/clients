import { CartResponse } from "@bitwarden/common/billing/models/response/cart.response";
import { StorageResponse } from "@bitwarden/common/billing/models/response/storage.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Cart } from "@bitwarden/pricing";
import {
  BitwardenSubscription,
  Storage,
  SubscriptionStatus,
  SubscriptionStatuses,
} from "@bitwarden/subscription";

export class BitwardenSubscriptionResponse extends BaseResponse {
  status: SubscriptionStatus;
  cart: Cart;
  storage: Storage;
  cancelAt?: Date;
  canceled?: Date;
  nextCharge?: Date;
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

    this.cart = new CartResponse(this.getResponseProperty("Cart"));
    this.storage = new StorageResponse(this.getResponseProperty("Storage"));

    const suspension = this.getResponseProperty("Suspension");
    if (suspension) {
      this.suspension = new Date(suspension);
    }

    const gracePeriod = this.getResponseProperty("GracePeriod");
    if (gracePeriod) {
      this.gracePeriod = gracePeriod;
    }

    const nextCharge = this.getResponseProperty("NextCharge");
    if (nextCharge) {
      this.nextCharge = new Date(nextCharge);
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

  toDomain = (): BitwardenSubscription => {
    switch (this.status) {
      case SubscriptionStatuses.Incomplete:
      case SubscriptionStatuses.IncompleteExpired:
      case SubscriptionStatuses.PastDue:
      case SubscriptionStatuses.Unpaid: {
        return {
          cart: this.cart,
          storage: this.storage,
          status: this.status,
          suspension: this.suspension!,
          gracePeriod: this.gracePeriod!,
        };
      }
      case SubscriptionStatuses.Trialing:
      case SubscriptionStatuses.Active: {
        return {
          cart: this.cart,
          storage: this.storage,
          status: this.status,
          nextCharge: this.nextCharge!,
          cancelAt: this.cancelAt,
        };
      }
      case SubscriptionStatuses.Canceled: {
        return {
          cart: this.cart,
          storage: this.storage,
          status: this.status,
          canceled: this.canceled!,
        };
      }
    }
  };
}
