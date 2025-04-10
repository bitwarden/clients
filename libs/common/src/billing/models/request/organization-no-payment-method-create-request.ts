// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationKeysRequest } from "../../../admin-console/models/request/organization-keys.request";
import { InitiationPath } from "../../../models/request/reference-event.request";
import { PlanType } from "../../enums";

export class OrganizationNoPaymentMethodCreateRequest {
  name: string;
  businessName: string;
  billingEmail: string;
  planType: PlanType;
  key: string;
  keys: OrganizationKeysRequest;
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
  isFromSecretsManagerTrial: boolean;
  initiationPath: InitiationPath;
}
