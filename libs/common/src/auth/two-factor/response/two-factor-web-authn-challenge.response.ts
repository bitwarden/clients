import { BaseResponse } from "../../../models/response/base.response";
import { WebAuthnChallengeResponse } from "../../models/response/web-authn-challenge.response";

/**
 * Response from requesting a WebAuthn (FIDO2) credential creation challenge for two factor setup.
 */
export class TwoFactorWebAuthnChallengeResponse extends BaseResponse {
  options: WebAuthnChallengeResponse | null;

  constructor(response: any) {
    super(response);
    const options = this.getResponseProperty("Options");
    this.options = options == null ? null : new WebAuthnChallengeResponse(options);
  }
}
