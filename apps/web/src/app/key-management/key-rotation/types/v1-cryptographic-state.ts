import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { UnsignedPublicKey, WrappedPrivateKey } from "@bitwarden/legacy-crypto";

export type V1UserCryptographicState = {
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: WrappedPrivateKey;
    publicKey: UnsignedPublicKey;
  };
};
