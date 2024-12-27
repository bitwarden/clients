import { BaseResponse } from "../../../models/response/base.response";

export class IdentityDeviceVerificationResponse extends BaseResponse {
  deviceVerified: boolean;

  constructor(response: any) {
    super(response);
    this.deviceVerified = this.getResponseProperty("DeviceVerified") ?? false;
  }
}
