import { BaseResponse } from "../../../models/response/base.response";

export class TwoFactorAuthenticatorResponse extends BaseResponse {
  enabled: boolean;
  key: string;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.key = this.getResponseProperty("Key");
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
