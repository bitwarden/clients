import { BaseResponse } from "../../../models/response/base.response";

import { WebAuthnChallengeResponse } from "./web-authn-challenge.response";

/**
 * Wrapper around {@link WebAuthnChallengeResponse} that adds the user-verification token minted by
 * the server-side `GetWebAuthnChallenge` endpoint. Replaces the previous response shape, which
 * returned the FIDO2 options object directly and had no place to attach the token.
 */
export class TwoFactorWebAuthnChallengeResponse extends BaseResponse {
  options: WebAuthnChallengeResponse | null;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    const options = this.getResponseProperty("Options");
    this.options = options == null ? null : new WebAuthnChallengeResponse(options);
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
