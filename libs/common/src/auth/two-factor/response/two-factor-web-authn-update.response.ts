import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorWebAuthnDetailsResponse } from "./two-factor-web-authn-details.response";

/**
 * Response from updating a user's WebAuthn (FIDO2) two factor provider data.
 */
export class TwoFactorWebAuthnUpdateResponse extends BaseResponse {
  webAuthn: TwoFactorWebAuthnDetailsResponse;

  constructor(response: any) {
    super(response);
    this.webAuthn = new TwoFactorWebAuthnDetailsResponse(this.getResponseProperty("WebAuthn"));
  }
}
