import { Utils } from "@bitwarden/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { UnsignedPublicKey, WrappedPrivateKey } from "@bitwarden/legacy-crypto";
import { SignedPublicKey } from "@bitwarden/sdk-internal";

export class PublicKeyEncryptionKeyPairRequestModel {
  wrappedPrivateKey: WrappedPrivateKey;
  publicKey: string;
  signedPublicKey: SignedPublicKey | null;

  constructor(
    wrappedPrivateKey: WrappedPrivateKey,
    publicKey: UnsignedPublicKey,
    signedPublicKey: SignedPublicKey | null,
  ) {
    this.wrappedPrivateKey = wrappedPrivateKey;
    this.publicKey = Utils.fromBufferToB64(publicKey);
    this.signedPublicKey = signedPublicKey;
  }
}
