import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorWebAuthnDetailsResponse } from "./two-factor-web-authn-details.response";

/**
 * Response for `DELETE /two-factor/webauthn` (per-credential). The operation modifies
 * the WebAuthn provider's credentials list rather than destroying the provider, so the
 * response carries the updated parent state. All other 2FA DELETE endpoints return
 * 204 No Content.
 */
export class TwoFactorWebAuthnDeleteResponse extends BaseResponse {
  webAuthn: TwoFactorWebAuthnDetailsResponse;

  constructor(response: any) {
    super(response);
    this.webAuthn = new TwoFactorWebAuthnDetailsResponse(this.getResponseProperty("WebAuthn"));
  }
}
