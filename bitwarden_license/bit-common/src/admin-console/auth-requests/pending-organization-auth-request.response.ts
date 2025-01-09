import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class PendingOrganizationAuthRequestResponse extends BaseResponse {
  id: string;
  userId: string;
  organizationUserId: string;
  email: string;
  publicKey: string;
  requestDeviceIdentifier: string;
  requestDeviceType: string;
  requestIpAddress: string;
  creationDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.email = this.getResponseProperty("Email");
    this.publicKey = this.getResponseProperty("PublicKey");
    this.requestDeviceIdentifier = this.getResponseProperty("RequestDeviceIdentifier");
    this.requestDeviceType = this.getResponseProperty("RequestDeviceType");
    this.requestIpAddress = this.getResponseProperty("RequestIpAddress");
    this.creationDate = this.getResponseProperty("CreationDate");
  }
}
