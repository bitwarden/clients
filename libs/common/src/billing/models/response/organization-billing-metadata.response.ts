import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationBillingMetadataResponse extends BaseResponse {
  isOnSecretsManagerStandalone: boolean;
  organizationOccupiedSeats: number;

  constructor(response: any) {
    super(response);
    this.isOnSecretsManagerStandalone = this.getResponseProperty("IsOnSecretsManagerStandalone");
    this.organizationOccupiedSeats = this.getResponseProperty("OrganizationOccupiedSeats");
  }
}
