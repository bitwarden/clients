import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class IdentityDeviceVerificationResponse extends BaseResponse {
  deviceVerified: boolean;
  captchaToken: string;

  constructor(response: any) {
    super(response);
    this.deviceVerified = this.getResponseProperty("DeviceVerified") ?? false;

    this.captchaToken = this.getResponseProperty("CaptchaBypassToken");
  }
}
