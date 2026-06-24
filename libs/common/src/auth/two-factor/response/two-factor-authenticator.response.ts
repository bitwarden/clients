import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorAuthenticatorDetailsResponse } from "./two-factor-authenticator-details.response";

/**
 * Response for `POST /two-factor/get-authenticator`. Wraps the provider details and the
 * user-verification token minted by the GET endpoint.
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
