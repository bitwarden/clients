import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorDuoDetailsResponse } from "./two-factor-duo-details.response";

/**
 * Response from updating a user's Duo two factor provider data.
 */
export class TwoFactorDuoUpdateResponse extends BaseResponse {
  duo: TwoFactorDuoDetailsResponse;

  constructor(response: any) {
    super(response);
    this.duo = new TwoFactorDuoDetailsResponse(this.getResponseProperty("Duo"));
  }
}
