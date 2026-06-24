import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorEmailDetailsResponse } from "./two-factor-email-details.response";

/**
 * Response for `PUT /two-factor/email`. Wraps the post-update provider details.
 */
export class TwoFactorEmailUpdateResponse extends BaseResponse {
  email: TwoFactorEmailDetailsResponse;

  constructor(response: any) {
    super(response);
    this.email = new TwoFactorEmailDetailsResponse(this.getResponseProperty("Email"));
  }
}
