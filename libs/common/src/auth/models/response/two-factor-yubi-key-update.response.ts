import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorYubiKeyDetailsResponse } from "./two-factor-yubi-key-details.response";

/**
 * Response for `PUT /two-factor/yubikey`. Wraps the post-update provider details.
 */
export class TwoFactorYubiKeyUpdateResponse extends BaseResponse {
  yubiKey: TwoFactorYubiKeyDetailsResponse;

  constructor(response: any) {
    super(response);
    this.yubiKey = new TwoFactorYubiKeyDetailsResponse(this.getResponseProperty("YubiKey"));
  }
}
