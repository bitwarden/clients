import { Utils } from "@bitwarden/common/platform/misc/utils";

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
    this.rawId = Utils.fromBufferToB64(credential.rawId);
    this.type = credential.type;
    this.extensions = {}; // Extensions are handled client-side
  }
}
