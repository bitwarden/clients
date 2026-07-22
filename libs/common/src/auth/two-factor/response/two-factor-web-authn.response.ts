import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorWebAuthnDetailsResponse } from "./two-factor-web-authn-details.response";

/**
 * Response from retrieving a user's WebAuthn (FIDO2) two factor provider data.
 */
export class TwoFactorWebAuthnResponse extends BaseResponse {
  webAuthn: TwoFactorWebAuthnDetailsResponse;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    this.webAuthn = new TwoFactorWebAuthnDetailsResponse(this.getResponseProperty("WebAuthn"));
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
