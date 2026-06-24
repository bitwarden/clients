import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorAuthenticatorDetailsResponse } from "./two-factor-authenticator-details.response";

/**
 * Response for `PUT /two-factor/authenticator`. Wraps the post-update provider details.
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
