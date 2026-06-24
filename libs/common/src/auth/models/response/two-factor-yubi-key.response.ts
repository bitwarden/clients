import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorYubiKeyDetailsResponse } from "./two-factor-yubi-key-details.response";

/**
 * Response for `POST /two-factor/get-yubikey`. Wraps the provider details and the
 * user-verification token minted by the GET endpoint.
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
