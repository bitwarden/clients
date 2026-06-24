import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorWebAuthnDetailsResponse } from "./two-factor-web-authn-details.response";

/**
 * Response for `PUT /two-factor/webauthn`. Wraps the post-update provider details.
 */
export class TwoFactorWebAuthnUpdateResponse extends BaseResponse {
  webAuthn: TwoFactorWebAuthnDetailsResponse;

  constructor(response: any) {
    super(response);
    this.webAuthn = new TwoFactorWebAuthnDetailsResponse(this.getResponseProperty("WebAuthn"));
  }
}
