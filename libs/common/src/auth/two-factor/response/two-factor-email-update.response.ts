import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorEmailDetailsResponse } from "./two-factor-email-details.response";

/**
 * Response from updating a user's email two factor provider data.
 */
export class TwoFactorEmailUpdateResponse extends BaseResponse {
  email: TwoFactorEmailDetailsResponse;

  constructor(response: any) {
    super(response);
    this.email = new TwoFactorEmailDetailsResponse(this.getResponseProperty("Email"));
  }
}
