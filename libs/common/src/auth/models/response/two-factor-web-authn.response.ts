import { BaseResponse } from "../../../models/response/base.response";

import { TwoFactorWebAuthnDetailsResponse } from "./two-factor-web-authn-details.response";

/**
 * Response for `POST /two-factor/get-webauthn`. Wraps the provider details and the
 * user-verification token minted by the GET endpoint.
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
