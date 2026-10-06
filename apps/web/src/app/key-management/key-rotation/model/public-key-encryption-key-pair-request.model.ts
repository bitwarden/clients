import { Utils } from "@bitwarden/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { UnsignedPublicKey, WrappedPrivateKey } from "@bitwarden/legacy-crypto";

export class PublicKeyEncryptionKeyPairRequestModel {
  wrappedPrivateKey: WrappedPrivateKey;
  publicKey: string;

  constructor(wrappedPrivateKey: WrappedPrivateKey, publicKey: UnsignedPublicKey) {
    this.wrappedPrivateKey = wrappedPrivateKey;
    this.publicKey = Utils.fromBufferToB64(publicKey);
  }
}
