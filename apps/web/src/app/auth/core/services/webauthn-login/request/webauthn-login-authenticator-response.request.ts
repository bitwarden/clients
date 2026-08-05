import { Fido2Utils } from "@bitwarden/common/platform/services/fido2/fido2-utils";

/**
 * An abstract class that represents responses received from the webauthn authenticator.
 * It contains data that is commonly returned during different types of authenticator interactions.
 */
export abstract class WebauthnLoginAuthenticatorResponseRequest {
  id: string;
  rawId: string;
  type: string;
  extensions: Record<string, unknown>;

  constructor(credential: PublicKeyCredential) {
    this.id = credential.id;
    this.rawId = Fido2Utils.arrayToString(Fido2Utils.bufferSourceToUint8Array(credential.rawId));
    this.type = credential.type;
    this.extensions = {}; // Extensions are handled client-side
  }
}
