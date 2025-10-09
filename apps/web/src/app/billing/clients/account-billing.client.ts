import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { BillingAddress, TokenizedPaymentMethod } from "../payment/types";

@Injectable()
export class AccountBillingClient {
  private endpoint = "/account/billing/vnext";
  private apiService: ApiService;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }

  purchasePremiumSubscription = async (
    paymentMethod: TokenizedPaymentMethod,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<void> => {
    const path = `${this.endpoint}/subscription`;
    const request = { tokenizedPaymentMethod: paymentMethod, billingAddress: billingAddress };
    await this.apiService.send("POST", path, request, true, true);
  };
}
