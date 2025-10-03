import { SecurityStateResponse } from "../../security-state/response/security-state.response";

import { PublicKeyEncryptionKeyPairResponse } from "./public-key-encryption-key-pair.response";
import { SignatureKeyPairResponse } from "./signature-key-pair.response";

/**
 * The privately accessible view of an entity (account / org)'s keys.
 * This includes the full key-pairs for public-key encryption and signing, as well as the security state if available.
 */
export class PrivateKeysResponseModel {
  readonly publicKeyEncryptionKeyPair: PublicKeyEncryptionKeyPairResponse;
  readonly signatureKeyPair: SignatureKeyPairResponse | null = null;
  readonly securityState: SecurityStateResponse | null = null;

  constructor(response: unknown) {
    if (typeof response !== "object" || response == null) {
      throw new TypeError("Response must be an object");
    }

    if (
      !("publicKeyEncryptionKeyPair" in response) ||
      typeof response.publicKeyEncryptionKeyPair !== "object"
    ) {
      throw new TypeError("Response must contain a valid publicKeyEncryptionKeyPair");
    }
    this.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairResponse(
      response.publicKeyEncryptionKeyPair,
    );

    if (
      "signatureKeyPair" in response &&
      typeof response.signatureKeyPair === "object" &&
      response.signatureKeyPair != null
    ) {
      this.signatureKeyPair = new SignatureKeyPairResponse(response.signatureKeyPair);
    }

    if (
      "securityState" in response &&
      typeof response.securityState === "object" &&
      response.securityState != null
    ) {
      this.securityState = new SecurityStateResponse(response.securityState);
    }

    if (
      (this.signatureKeyPair !== null && this.securityState === null) ||
      (this.signatureKeyPair === null && this.securityState !== null)
    ) {
      throw new TypeError(
        "Both signatureKeyPair and securityState must be present or absent together",
      );
    }
  }
}
