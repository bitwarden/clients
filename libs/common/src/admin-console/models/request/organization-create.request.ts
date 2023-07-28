import { PaymentMethodType, PlanType } from "../../../billing/enums";

import { OrganizationKeysRequest } from "./organization-keys.request";

export class OrganizationCreateRequest {
  name: string;
  businessName: string;
  billingEmail: string;
  planType: PlanType;
  key: string;
  keys: OrganizationKeysRequest;
  paymentMethodType: PaymentMethodType;
  paymentToken: string;
  additionalSeats: number;
  maxAutoscaleSeats: number;
  additionalStorageGb: number;
  premiumAccessAddon: boolean;
  collectionName: string;
  taxIdNumber: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingAddressCity: string;
  billingAddressState: string;
  billingAddressPostalCode: string;
  billingAddressCountry: string;

  useSecretsManager: boolean;
  additionalSmSeats: number;
  additionalServiceAccounts: number;
}
