import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorAuthenticatorDetailsResponse } from "./two-factor-authenticator-details.response";

/**
 * Response from updating a user's authenticator (TOTP) two factor provider data.
 */
export class TwoFactorAuthenticatorUpdateResponse extends BaseResponse {
  authenticator: TwoFactorAuthenticatorDetailsResponse;

  constructor(response: any) {
    super(response);
    this.authenticator = new TwoFactorAuthenticatorDetailsResponse(
      this.getResponseProperty("Authenticator"),
    );
  }
}
