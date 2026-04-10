import { UserKey } from "../../../types/key";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";
import { CRYPTO_DISK, CRYPTO_MEMORY, UserKeyDefinition } from "../../state";

/**
 * Ever had user key is a hack that allows differentiating TDE users that
 * have logged and unlocked in at least once fully, from ones that have not.
 * Depending on this, routing happens to the login-initiated or lock component.
 * The former allows trusting the device, and has master password (if available)
 * or trusted-device / admin approval as unlock methods. The latter has regular
 * lock methods.
 *
 * Ideally, this state hack would be replaced by a more robust solution that just
 * checks the available unlock methods, and routes depending on those.
 */
export const USER_EVER_HAD_USER_KEY = new UserKeyDefinition<boolean>(
  CRYPTO_DISK,
  "everHadUserKey",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);

export const USER_KEY = UserKeyDefinition.record<UserKey>(CRYPTO_MEMORY, "userKey", {
  deserializer: (obj) => SymmetricCryptoKey.fromJSON(obj) as UserKey,
  clearOn: ["logout", "lock"],
  // Prevents the state from caching and rxjs observable becoming hot observable.
  cleanupDelayMs: 0,
});
