import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";

import { WebauthnLoginAuthenticatorResponseRequest } from "./webauthn-login-authenticator-response.request";

/**
 * The response received from an authenticator after a successful attestation.
 * This request is used to save newly created webauthn login credentials to the server.
 */
export class WebauthnLoginAttestationResponseRequest extends WebauthnLoginAuthenticatorResponseRequest {
  response: {
    attestationObject: string;
    clientDataJson: string;
    transports: string[];
  };

  constructor(credential: PublicKeyCredential) {
    super(credential);

    if (!(credential.response instanceof AuthenticatorAttestationResponse)) {
      throw new Error("Invalid authenticator response");
    }

    this.response = {
      attestationObject: Fido2Utils.arrayToString(
        Fido2Utils.bufferSourceToUint8Array(credential.response.attestationObject),
      ),
      clientDataJson: Fido2Utils.arrayToString(
        Fido2Utils.bufferSourceToUint8Array(credential.response.clientDataJSON),
      ),
      transports: credential.response.getTransports(),
    };
  }
}
