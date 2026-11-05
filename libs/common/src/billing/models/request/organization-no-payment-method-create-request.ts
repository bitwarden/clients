import { OrganizationKeysRequest } from "../../../admin-console/models/request/organization-keys.request";
import { InitiationPath, PlanType } from "../../enums";

export class OrganizationNoPaymentMethodCreateRequest {
  name: string = "";
  businessName: string = "";
  billingEmail: string = "";
  planType!: PlanType;
  key: string;
  keys: OrganizationKeysRequest;
  additionalSeats: number = 0;
  maxAutoscaleSeats: number = 0;
  additionalStorageGb: number = 0;
  premiumAccessAddon: boolean = false;
  collectionName: string;
  taxIdNumber: string = "";
  billingAddressLine1: string = "";
  billingAddressLine2: string = "";
  billingAddressCity: string = "";
  billingAddressState: string = "";
  billingAddressPostalCode: string = "";
  billingAddressCountry: string = "";
  useSecretsManager: boolean = false;
  additionalSmSeats: number = 0;
  additionalServiceAccounts: number = 0;
  isFromSecretsManagerTrial: boolean = false;
  usePrivilegedControls: boolean = false;
  pamSeats?: number;
  initiationPath!: InitiationPath;
  /**
   * The sales invitation token. The server honors it only together with the sales-assisted initiationPath,
   * and only on the no-payment create endpoint.
   */
  salesAssistedToken?: string;
  trialLength?: number;

  constructor(key: string, keys: OrganizationKeysRequest, collectionName: string) {
    if (!key) {
      throw new Error("Organization key is required");
    }
    if (!keys) {
      throw new Error("Organization keys are required");
    }
    if (!collectionName) {
      throw new Error("Collection name is required");
    }
    this.key = key;
    this.keys = keys;
    this.collectionName = collectionName;
  }
}
