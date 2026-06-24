import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorDuoDetailsResponse } from "./two-factor-duo-details.response";

/**
 * Response for `POST /organizations/{id}/two-factor/get-duo`. Wraps the organization-scoped
 * Duo provider details and the user-verification token minted by the GET endpoint.
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
