import { UserKey } from "../../../types/key";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";
import { CRYPTO_MEMORY, UserKeyDefinition } from "../../state";

export const USER_KEY = UserKeyDefinition.record<UserKey>(CRYPTO_MEMORY, "userKey", {
  deserializer: (obj) => SymmetricCryptoKey.fromJSON(obj) as UserKey,
  clearOn: ["logout", "lock"],
});
