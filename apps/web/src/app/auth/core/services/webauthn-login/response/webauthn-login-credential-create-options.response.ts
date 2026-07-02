import { WebAuthnChallengeResponse } from "@bitwarden/common/auth/models/response/web-authn-challenge.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Options provided by the server to be used during attestation (i.e. creation of a new webauthn credential)
 */
export class WebauthnLoginCredentialCreateOptionsResponse extends BaseResponse {
  /** Options to be provided to the webauthn authenticator */
  options: WebAuthnChallengeResponse;

  /**
   * Contains an encrypted version of the {@link options}.
   * Used by the server to validate the attestation response of newly created credentials.
   */
  token: string;

  constructor(response: unknown) {
    super(response);
    this.options = new WebAuthnChallengeResponse(this.getResponseProperty("options"));
    this.token = this.getResponseProperty("token");
  }
}
