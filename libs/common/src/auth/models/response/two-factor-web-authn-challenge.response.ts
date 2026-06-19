import { BaseResponse } from "../../../models/response/base.response";

import { ChallengeResponse } from "./two-factor-web-authn.response";

/**
 * Wrapper around {@link ChallengeResponse} that adds the user-verification token minted by
 * the server-side `GetWebAuthnChallenge` endpoint. Replaces the previous response shape, which
 * returned the FIDO2 options object directly and had no place to attach the token.
 */
export class TwoFactorWebAuthnChallengeResponse extends BaseResponse {
  options: ChallengeResponse | null;
  userVerificationToken: string;

  constructor(response: any) {
    super(response);
    const options = this.getResponseProperty("Options");
    this.options = options == null ? null : new ChallengeResponse(options);
    this.userVerificationToken = this.getResponseProperty("UserVerificationToken");
  }
}
