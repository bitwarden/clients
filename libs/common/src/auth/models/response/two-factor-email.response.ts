import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorEmailDetailsResponse } from "./two-factor-email-details.response";

/**
 * Response for `POST /two-factor/get-email`. Wraps the provider details and the
 * user-verification token minted by the GET endpoint.
 */
export class TwoFactorEmailResponse extends BaseResponse {
  email: TwoFactorEmailDetailsResponse;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.email = new TwoFactorEmailDetailsResponse(this.getResponseProperty("Email"));
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
