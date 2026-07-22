import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorYubiKeyDetailsResponse } from "./two-factor-yubi-key-details.response";

/**
 * Response from updating a user's YubiKey two factor provider data.
 */
export class TwoFactorYubiKeyUpdateResponse extends BaseResponse {
  yubiKey: TwoFactorYubiKeyDetailsResponse;

  constructor(response: any) {
    super(response);
    this.yubiKey = new TwoFactorYubiKeyDetailsResponse(this.getResponseProperty("YubiKey"));
  }
}
