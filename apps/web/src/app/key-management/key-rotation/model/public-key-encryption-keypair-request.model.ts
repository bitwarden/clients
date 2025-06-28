import { EncString, SignedPublicKey } from "@bitwarden/sdk-internal";

export class PublicKeyEncryptionKeyPairRequestModel {
  wrappedPrivateKey: EncString;
  publicKey: string;
  signedPublicKey: SignedPublicKey | null;

  constructor(
    wrappedPrivateKey: EncString,
    publicKey: string,
    signedPublicKey: SignedPublicKey | null,
  ) {
    this.wrappedPrivateKey = wrappedPrivateKey;
    this.publicKey = publicKey;
    this.signedPublicKey = signedPublicKey;
  }
}
