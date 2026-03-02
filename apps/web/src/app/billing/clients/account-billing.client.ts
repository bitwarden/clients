import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BitwardenSubscriptionResponse } from "@bitwarden/common/billing/models/response/bitwarden-subscription.response";
import { SubscriptionCadence } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { Maybe } from "@bitwarden/pricing";
import { BitwardenSubscription } from "@bitwarden/subscription";

import {
  BillingAddress,
  NonTokenizedPaymentMethod,
  TokenizedPaymentMethod,
} from "../payment/types";

export type UpgradePremiumToOrganizationRequest = {
  organizationName: string;
  organizationKey: string;
  collectionName: string | null;
  publicKey: string;
  encryptedPrivateKey: string;
  planTier: ProductTierType;
  cadence: SubscriptionCadence;
  billingAddress: Pick<BillingAddress, "country" | "postalCode">;
};

@Injectable()
export class AccountBillingClient {
  private endpoint = "/account/billing/vnext";

  constructor(private apiService: ApiService) {}

  getLicense = async (): Promise<string> => {
    const path = `${this.endpoint}/license`;
    return this.apiService.send("GET", path, null, true, true);
  };

  getSubscription = async (): Promise<Maybe<BitwardenSubscription>> => {
    const path = `${this.endpoint}/subscription`;
    try {
      const json = await this.apiService.send("GET", path, null, true, true);
      const response = new BitwardenSubscriptionResponse(json);
      return response.toDomain();
    } catch (error: any) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
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
    request: UpgradePremiumToOrganizationRequest,
  ): Promise<string> => {
    const path = `${this.endpoint}/upgrade`;
    return await this.apiService.send(
      "POST",
      path,
      {
        organizationName: request.organizationName,
        key: request.organizationKey,
        collectionName: request.collectionName,
        publicKey: request.publicKey,
        encryptedPrivateKey: request.encryptedPrivateKey,
        targetProductTierType: request.planTier,
        cadence: request.cadence as string,
        billingAddress: request.billingAddress,
      },
      true,
      true,
    );
  };
}
