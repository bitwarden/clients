import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorWebAuthnDetailsResponse } from "./two-factor-web-authn-details.response";

/**
 * Response from removing a single credential from a user's WebAuthn (FIDO2) two factor
 * provider, returning the updated provider data.
 */
export class TwoFactorWebAuthnDeleteResponse extends BaseResponse {
  webAuthn: TwoFactorWebAuthnDetailsResponse;

  constructor(response: any) {
    super(response);
    this.webAuthn = new TwoFactorWebAuthnDetailsResponse(this.getResponseProperty("WebAuthn"));
  }
}
