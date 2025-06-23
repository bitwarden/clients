import { SecurityStateResponseModel } from "../../security-state/response/security-state.response";

import { PublicKeyEncryptionKeyPairResponse } from "./public-key-encryption-key-pair.response";
import { SignatureKeyPairResponse } from "./signature-key-pair.response";

export class PrivateKeysResponseModel {
  readonly signatureKeyPair: SignatureKeyPairResponse | null = null;
  readonly publicKeyEncryptionKeyPair: PublicKeyEncryptionKeyPairResponse;
  readonly securityState: SecurityStateResponseModel | null = null;

  constructor(response: any) {
    if ("signatureKeyPair" in response && response.signatureKeyPair != null) {
      this.signatureKeyPair = new SignatureKeyPairResponse(response.signatureKeyPair);
    }
    if ("securityState" in response && response.securityState != null) {
      this.securityState = new SecurityStateResponseModel(response.securityState);
    }

    this.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairResponse(
      response.publicKeyEncryptionKeyPair,
    );
  }
}
