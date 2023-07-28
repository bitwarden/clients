import { PlanType } from "../../../billing/enums";

import { OrganizationKeysRequest } from "./organization-keys.request";

export class OrganizationUpgradeRequest {
  businessName: string;
  planType: PlanType;
  additionalSeats: number;
  additionalStorageGb: number;
  premiumAccessAddon: boolean;
  billingAddressCountry: string;
  billingAddressPostalCode: string;
  keys: OrganizationKeysRequest;

  useSecretsManager: boolean;
  additionalSmSeats: number;
  additionalServiceAccounts: number;
}
