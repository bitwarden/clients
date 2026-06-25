import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorYubiKeyDetailsResponse } from "./two-factor-yubi-key-details.response";

/**
 * Response from retrieving a user's YubiKey two factor provider data.
 */
export class TwoFactorYubiKeyResponse extends BaseResponse {
  yubiKey: TwoFactorYubiKeyDetailsResponse;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.yubiKey = new TwoFactorYubiKeyDetailsResponse(this.getResponseProperty("YubiKey"));
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
