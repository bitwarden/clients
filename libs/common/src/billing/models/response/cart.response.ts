import { Cart, CartItem, Discount } from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";
import { SubscriptionCadence, SubscriptionCadenceIds } from "../../types/subscription-pricing-tier";

import { DiscountResponse } from "./discount.response";

export class CartItemResponse extends BaseResponse implements CartItem {
  translationKey: string;
  quantity: number;
  cost: number;
  discounts?: Discount[];

  constructor(response: any) {
    super(response);

    this.translationKey = this.getResponseProperty("TranslationKey");
    this.quantity = this.getResponseProperty("Quantity");
    this.cost = this.getResponseProperty("Cost");
    // The legacy API sends a single discount. Wrap it in a one-element array so flag-OFF carts
    // render under the array shape the shared template now expects. Deliberately passed through
    // raw, exactly as before, so this introduces no new parse or throw path.
    // TODO(PM-40422): remove with the legacy BitwardenSubscription response chain.
    const discount = this.getResponseProperty("Discount");
    if (discount) {
      this.discounts = [discount];
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
  discounts?: Discount[];
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
      this.discounts = [new DiscountResponse(discount)];
    }

    this.estimatedTax = this.getResponseProperty("EstimatedTax");
  }
}
