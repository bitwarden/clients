import { PublicKeyEncryptionKeyPairResponse } from "./public-key-encryption-key-pair.response";
import { SignatureKeyPairResponse } from "./signature-key-pair.response";

export class PrivateKeysResponseModel {
  readonly signatureKeyPair: SignatureKeyPairResponse | null = null;
  readonly publicKeyEncryptionKeyPair: PublicKeyEncryptionKeyPairResponse;

  constructor(response: any) {
    if ("signatureKeyPair" in response && response.signatureKeyPair != null) {
      this.signatureKeyPair = new SignatureKeyPairResponse(response.signatureKeyPair);
    }

    this.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairResponse(
      response.publicKeyEncryptionKeyPair,
    );
  }
}
