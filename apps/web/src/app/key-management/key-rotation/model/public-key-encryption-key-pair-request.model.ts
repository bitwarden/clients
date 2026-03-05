import { UnsignedPublicKey, WrappedPrivateKey } from "@bitwarden/common/key-management/types";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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
