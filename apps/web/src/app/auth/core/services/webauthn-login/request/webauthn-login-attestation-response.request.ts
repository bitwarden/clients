import { Utils } from "@bitwarden/common/platform/misc/utils";

import { WebauthnLoginAuthenticatorResponseRequest } from "./webauthn-login-authenticator-response.request";

/**
 * The response received from an authenticator after a successful attestation.
 * This request is used to save newly created webauthn login credentials to the server.
 */
export class WebauthnLoginAttestationResponseRequest extends WebauthnLoginAuthenticatorResponseRequest {
  response: {
    attestationObject: string;
    clientDataJson: string;
  };

  constructor(credential: PublicKeyCredential) {
    super(credential);

    if (!(credential.response instanceof AuthenticatorAttestationResponse)) {
      throw new Error("Invalid authenticator response");
    }

    this.response = {
      attestationObject: Utils.fromBufferToUrlB64(credential.response.attestationObject),
      clientDataJson: Utils.fromBufferToUrlB64(credential.response.clientDataJSON),
    };
  }
}
