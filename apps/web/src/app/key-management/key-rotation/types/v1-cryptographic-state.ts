import { UserKey } from "@bitwarden/common/types/key";
import { EncString } from "@bitwarden/sdk-internal";

export type V1UserCryptographicState = {
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: EncString;
    publicKey: string;
  };
};
