import { EncryptedString } from "../../../key-management/crypto/models/enc-string";
import { UserKey } from "../../../types/key";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";
import { CRYPTO_DISK, CRYPTO_MEMORY, UserKeyDefinition } from "../../state";

export const USER_EVER_HAD_USER_KEY = new UserKeyDefinition<boolean>(
  CRYPTO_DISK,
  "everHadUserKey",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);

export const USER_ENCRYPTED_PRIVATE_KEY = new UserKeyDefinition<EncryptedString>(
  CRYPTO_DISK,
  "privateKey",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);

export const USER_KEY = new UserKeyDefinition<UserKey>(CRYPTO_MEMORY, "userKey", {
  deserializer: (obj) => SymmetricCryptoKey.fromJSON(obj) as UserKey,
  clearOn: ["logout", "lock"],
});
