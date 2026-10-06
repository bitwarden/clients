import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorAuthenticatorDetailsResponse } from "./two-factor-authenticator-details.response";

/**
 * Response from retrieving a user's authenticator (TOTP) two factor provider data.
 */
export class TwoFactorAuthenticatorResponse extends BaseResponse {
  authenticator: TwoFactorAuthenticatorDetailsResponse;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.authenticator = new TwoFactorAuthenticatorDetailsResponse(
      this.getResponseProperty("Authenticator"),
    );
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
