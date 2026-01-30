import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BitwardenSubscriptionResponse } from "@bitwarden/common/billing/models/response/bitwarden-subscription.response";
import { SubscriptionCadence } from "@bitwarden/common/billing/types/subscription-pricing-tier";
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

  upgradePremiumToOrganization = async (
    organizationName: string,
    organizationKey: string,
    planTier: ProductTierType,
    cadence: SubscriptionCadence,
    billingAddress: Pick<BillingAddress, "country" | "postalCode">,
  ): Promise<void> => {
    const path = `${this.endpoint}/upgrade`;
    await this.apiService.send(
      "POST",
      path,
      {
        organizationName,
        key: organizationKey,
        targetProductTierType: planTier,
        cadence,
        billingAddress,
      },
      true,
      false,
    );
  };
}
