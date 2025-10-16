import { UnsignedPublicKey, WrappedPrivateKey } from "@bitwarden/common/key-management/types";
import { UserKey } from "@bitwarden/common/types/key";

export type V1UserCryptographicState = {
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: WrappedPrivateKey;
    publicKey: UnsignedPublicKey;
  };
};
