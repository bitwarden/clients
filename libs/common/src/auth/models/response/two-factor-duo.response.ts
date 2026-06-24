import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorDuoDetailsResponse } from "./two-factor-duo-details.response";

/**
 * Response for `POST /two-factor/get-duo`. Wraps the user-scoped Duo provider details
 * and the user-verification token minted by the GET endpoint.
 */
export class TwoFactorDuoResponse extends BaseResponse {
  duo: TwoFactorDuoDetailsResponse;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.duo = new TwoFactorDuoDetailsResponse(this.getResponseProperty("Duo"));
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
