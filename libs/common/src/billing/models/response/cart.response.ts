import {
  SubscriptionCadence,
  SubscriptionCadenceIds,
} from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Cart, CartItem, Discount } from "@bitwarden/pricing";

import { DiscountResponse } from "./discount.response";

export class CartItemResponse extends BaseResponse implements CartItem {
  translationKey: string;
  quantity: number;
  cost: number;
  discount?: Discount;

  constructor(response: any) {
    super(response);

    this.translationKey = this.getResponseProperty("TranslationKey");
    this.quantity = this.getResponseProperty("Quantity");
    this.cost = this.getResponseProperty("Cost");
    const discount = this.getResponseProperty("Discount");
    if (discount) {
      this.discount = discount;
    }
  }
}

class PasswordManagerCartItemResponse extends BaseResponse {
  seats: CartItem;
  additionalStorage?: CartItem;

  constructor(response: any) {
    super(response);

    this.seats = new CartItemResponse(this.getResponseProperty("Seats"));
    const additionalStorage = this.getResponseProperty("AdditionalStorage");
    if (additionalStorage) {
      this.additionalStorage = new CartItemResponse(additionalStorage);
    }
  }
}

class SecretsManagerCartItemResponse extends BaseResponse {
  seats: CartItem;
  additionalServiceAccounts?: CartItem;

  constructor(response: any) {
    super(response);

    this.seats = new CartItemResponse(this.getResponseProperty("Seats"));
    const additionalServiceAccounts = this.getResponseProperty("AdditionalServiceAccounts");
    if (additionalServiceAccounts) {
      this.additionalServiceAccounts = new CartItemResponse(additionalServiceAccounts);
    }
  }
}

export class CartResponse extends BaseResponse implements Cart {
  passwordManager: {
    seats: CartItem;
    additionalStorage?: CartItem;
  };
  secretsManager?: {
    seats: CartItem;
    additionalServiceAccounts?: CartItem;
  };
  cadence: SubscriptionCadence;
  discount?: Discount;
  estimatedTax: number;

  constructor(response: any) {
    super(response);

    this.passwordManager = new PasswordManagerCartItemResponse(
      this.getResponseProperty("PasswordManager"),
    );

    const secretsManager = this.getResponseProperty("SecretsManager");
    if (secretsManager) {
      this.secretsManager = new SecretsManagerCartItemResponse(secretsManager);
    }

    const cadence = this.getResponseProperty("Cadence");
    if (cadence !== SubscriptionCadenceIds.Annually && cadence !== SubscriptionCadenceIds.Monthly) {
      throw new Error(`Failed to parse invalid cadence: ${cadence}`);
    }
    this.cadence = cadence;

    const discount = this.getResponseProperty("Discount");
    if (discount) {
      this.discount = new DiscountResponse(discount);
    }

    this.estimatedTax = this.getResponseProperty("EstimatedTax");
  }
}
