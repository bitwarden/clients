import { PendingAuthRequestView } from "@bitwarden/bit-common/admin-console/auth-requests/";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class PendingAuthRequestResponse implements BaseResponse {
  object = "auth-request";

  id: string;
  userId: string;
  organizationUserId: string;
  email: string;
  requestDeviceIdentifier: string;
  requestDeviceType: string;
  requestIpAddress: string;
  creationDate: Date;

  constructor(authRequest: PendingAuthRequestView) {
    this.id = authRequest.id;
    this.userId = authRequest.userId;
    this.organizationUserId = authRequest.organizationUserId;
    this.email = authRequest.email;
    this.requestDeviceIdentifier = authRequest.requestDeviceIdentifier;
    this.requestDeviceType = authRequest.requestDeviceType;
    this.requestIpAddress = authRequest.requestIpAddress;
    this.creationDate = authRequest.creationDate;
  }
}
