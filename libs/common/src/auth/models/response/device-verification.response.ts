import { BaseResponse } from "../../../models/response/base.response";

export class DeviceVerificationResponse extends BaseResponse {
  isDeviceVerificationSectionEnabled: boolean;
  unknownDeviceVerificationEnabled: boolean;

  constructor(response: any) {
    super(response);
    this.isDeviceVerificationSectionEnabled = this.getResponseProperty(
      "IsDeviceVerificationSectionEnabled",
    );
    this.unknownDeviceVerificationEnabled = this.getResponseProperty(
      "UnknownDeviceVerificationEnabled",
    );
  }
}
