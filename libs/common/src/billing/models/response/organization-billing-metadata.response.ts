import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationBillingMetadataResponse extends BaseResponse {
  isEligibleForSelfHost: boolean;
  isManaged: boolean;
  isOnSecretsManagerStandalone: boolean;
  organizationOccupiedSeats: number;

  constructor(response: any) {
    super(response);
    this.isEligibleForSelfHost = this.getResponseProperty("IsEligibleForSelfHost");
    this.isManaged = this.getResponseProperty("IsManaged");
    this.isOnSecretsManagerStandalone = this.getResponseProperty("IsOnSecretsManagerStandalone");
    this.organizationOccupiedSeats = this.getResponseProperty("OrganizationOccupiedSeats");
  }
}
