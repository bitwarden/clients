import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorDuoDetailsResponse } from "./two-factor-duo-details.response";

/**
 * Response for `PUT /two-factor/duo`. Wraps the post-update user-scoped Duo provider details.
 */
export class TwoFactorDuoUpdateResponse extends BaseResponse {
  duo: TwoFactorDuoDetailsResponse;

  constructor(response: any) {
    super(response);
    this.duo = new TwoFactorDuoDetailsResponse(this.getResponseProperty("Duo"));
  }
}
