import { UserPrivateKey, UserPublicKey, UserKey } from "../../../types/key";
import { CryptoFunctionService } from "../../abstractions/crypto-function.service";
import { EncryptService } from "../../abstractions/encrypt.service";
import { EncString, EncryptedString } from "../../models/domain/enc-string";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";
import { KeyDefinition, CRYPTO_DISK, DeriveDefinition, CRYPTO_MEMORY } from "../../state";
import { CryptoService } from "../crypto.service";

export const USER_EVER_HAD_USER_KEY = new KeyDefinition<boolean>(CRYPTO_DISK, "everHadUserKey", {
  deserializer: (obj) => obj,
});

export const USER_ENCRYPTED_PRIVATE_KEY = new KeyDefinition<EncryptedString>(
  CRYPTO_DISK,
  "privateKey",
  {
    deserializer: (obj) => obj,
  },
);

export const USER_PRIVATE_KEY = DeriveDefinition.fromWithUserId<
  EncryptedString,
  UserPrivateKey,
  // TODO: update cryptoService to user key directly
  { encryptService: EncryptService; cryptoService: CryptoService }
>(USER_ENCRYPTED_PRIVATE_KEY, {
  deserializer: (obj) => new Uint8Array(Object.values(obj)) as UserPrivateKey,
  derive: async ([userId, encPrivateKeyString], { encryptService, cryptoService }) => {
    if (encPrivateKeyString == null) {
      return null;
    }

    const userKey = await cryptoService.getUserKey(userId);
    if (userKey == null) {
      return null;
    }

    const encPrivateKey = new EncString(encPrivateKeyString);
    const privateKey = (await encryptService.decryptToBytes(
      encPrivateKey,
      userKey,
    )) as UserPrivateKey;
    return privateKey;
  },
});

export const USER_PUBLIC_KEY = DeriveDefinition.from<
  UserPrivateKey,
  UserPublicKey,
  { cryptoFunctionService: CryptoFunctionService }
>([USER_PRIVATE_KEY, "publicKey"], {
  deserializer: (obj) => new Uint8Array(Object.values(obj)) as UserPublicKey,
  derive: async (privateKey, { cryptoFunctionService }) => {
    if (privateKey == null) {
      return null;
    }

    return (await cryptoFunctionService.rsaExtractPublicKey(privateKey)) as UserPublicKey;
  },
});
export const USER_KEY = new KeyDefinition<UserKey>(CRYPTO_MEMORY, "userKey", {
  deserializer: (obj) => SymmetricCryptoKey.fromJSON(obj) as UserKey,
});
