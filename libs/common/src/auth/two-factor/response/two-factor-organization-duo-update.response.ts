import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorDuoDetailsResponse } from "./two-factor-duo-details.response";

/**
 * Response for `PUT /organizations/{id}/two-factor/duo`. Wraps the post-update
 * organization-scoped Duo provider details.
 */
export class TwoFactorOrganizationDuoUpdateResponse extends BaseResponse {
  duo: TwoFactorDuoDetailsResponse;

  constructor(response: any) {
    super(response);
    this.duo = new TwoFactorDuoDetailsResponse(this.getResponseProperty("Duo"));
  }
}
