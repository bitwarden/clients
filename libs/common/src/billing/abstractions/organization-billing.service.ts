import { OrganizationResponse } from "../../admin-console/models/response/organization.response";
import { InitiationPath } from "../../models/request/reference-event.request";
import { PaymentMethodType, PlanType } from "../enums";

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
};

export type SubscriptionInformation = {
  organization: OrganizationInformation;
  plan?: PlanInformation;
  payment?: PaymentInformation;
};

export abstract class OrganizationBillingServiceAbstraction {
  purchaseSubscription: (subscription: SubscriptionInformation) => Promise<OrganizationResponse>;

  startFree: (subscription: SubscriptionInformation) => Promise<OrganizationResponse>;
}
