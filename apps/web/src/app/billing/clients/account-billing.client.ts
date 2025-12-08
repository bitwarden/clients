import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import {
  BillingAddress,
  NonTokenizedPaymentMethod,
  TokenizedPaymentMethod,
} from "../payment/types";

@Injectable()
export class AccountBillingClient {
  private endpoint = "/account/billing/vnext";
  private apiService: ApiService;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }

  purchasePremiumSubscription = async (
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
}
