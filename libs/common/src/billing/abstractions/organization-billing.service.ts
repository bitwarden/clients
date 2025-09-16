import { UserId } from "@bitwarden/user-core";

import { OrganizationResponse } from "../../admin-console/models/response/organization.response";
import { InitiationPath } from "../../models/request/reference-event.request";
import { PaymentMethodType, PlanType } from "../enums";
import { PaymentSourceResponse } from "../models/response/payment-source.response";

export type OrganizationInformation = {
  name: string;
  billingEmail: string;
  businessName?: string;
  initiationPath?: InitiationPath;
};

export type PlanInformation = {
  type: PlanType;
  passwordManagerSeats?: number;
  subscribeToSecretsManager?: boolean;
  isFromSecretsManagerTrial?: boolean;
  secretsManagerSeats?: number;
  secretsManagerServiceAccounts?: number;
  storage?: number;
};

export type BillingInformation = {
  postalCode: string;
  country: string;
  taxId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
};

export type PaymentInformation = {
  paymentMethod: [string, PaymentMethodType];
  billing: BillingInformation;
  skipTrial?: boolean;
};

export type SubscriptionInformation = {
  organization: OrganizationInformation;
  plan?: PlanInformation;
  payment?: PaymentInformation;
};

export abstract class OrganizationBillingServiceAbstraction {
  abstract getPaymentSource(organizationId: string): Promise<PaymentSourceResponse>;

  abstract purchaseSubscription(
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<OrganizationResponse>;

  abstract purchaseSubscriptionNoPaymentMethod(
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<OrganizationResponse>;

  abstract startFree(
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<OrganizationResponse>;

  abstract restartSubscription(
    organizationId: string,
    subscription: SubscriptionInformation,
    activeUserId: UserId,
  ): Promise<void>;
}
