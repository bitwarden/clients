import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorEmailDetailsResponse } from "./two-factor-email-details.response";

/**
 * Response from retrieving a user's email two factor provider data.
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
