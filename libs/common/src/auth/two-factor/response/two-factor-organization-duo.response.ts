import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorDuoDetailsResponse } from "./two-factor-duo-details.response";

/**
 * Response from retrieving an organization's Duo two factor provider data.
 */
export class TwoFactorOrganizationDuoResponse extends BaseResponse {
  duo: TwoFactorDuoDetailsResponse;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.duo = new TwoFactorDuoDetailsResponse(this.getResponseProperty("Duo"));
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
