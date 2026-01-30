import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BitwardenSubscriptionResponse } from "@bitwarden/common/billing/models/response/bitwarden-subscription.response";
import { BitwardenSubscription } from "@bitwarden/subscription";

import {
  BillingAddress,
  NonTokenizedPaymentMethod,
  TokenizedPaymentMethod,
} from "../payment/types";

@Injectable()
export class AccountBillingClient {
  private endpoint = "/account/billing/vnext";

  constructor(private apiService: ApiService) {}

  getLicense = async (): Promise<string> => {
    const path = `${this.endpoint}/license`;
    return this.apiService.send("GET", path, null, true, true);
  };

  getSubscription = async (): Promise<BitwardenSubscription> => {
    const path = `${this.endpoint}/subscription`;
    const json = await this.apiService.send("GET", path, null, true, true);
    const response = new BitwardenSubscriptionResponse(json);
    return response.toDomain();
  };

  purchaseSubscription = async (
    paymentMethod: TokenizedPaymentMethod | NonTokenizedPaymentMethod,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<void> => {
    const path = `${this.endpoint}/subscription`;

    // Determine the request payload based on the payment method type
    const isTokenizedPayment = "token" in paymentMethod;

    const request = isTokenizedPayment
      ? { tokenizedPaymentMethod: paymentMethod, billingAddress: billingAddress }
      : { nonTokenizedPaymentMethod: paymentMethod, billingAddress: billingAddress };

    await this.apiService.send("POST", path, request, true, true);
  };

  reinstateSubscription = async (): Promise<void> => {
    const path = `${this.endpoint}/subscription/reinstate`;
    await this.apiService.send("POST", path, null, true, false);
  };

  updateSubscriptionStorage = async (additionalStorageGb: number): Promise<void> => {
    const path = `${this.endpoint}/subscription/storage`;
    await this.apiService.send("PUT", path, { additionalStorageGb }, true, false);
  };
}
