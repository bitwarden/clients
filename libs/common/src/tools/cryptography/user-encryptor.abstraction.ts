// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { UserId } from "../../types/guid";

/** An encryption strategy that protects a type's secrets with
 *  SDK local user data key encryption. This strategy is bound to a specific user.
 */
export abstract class UserEncryptor {
  /** Identifies the user bound to the encryptor. */
  readonly userId: UserId;

  /** Protects secrets in `value` with the SDK local user data key.
   *  @param secret the object to protect.
   *  @returns a promise that resolves to an encrypted secret.
   *  @throws If `value` is `null` or `undefined`, the promise rejects with an error.
   */
  abstract encrypt<Secret>(secret: Jsonify<Secret>): Promise<EncString>;

  /** Decrypts a protected secret into a type that can be rehydrated into a domain object.
   *  @param secret an encrypted JSON payload containing encrypted secrets.
   *  @returns a promise that resolves to the raw state. This state *is not* a
   *    class. It contains only data that can be round-tripped through JSON,
   *    and lacks members such as a prototype or bound functions.
   *  @throws If `secret` is `null` or `undefined`, the promise rejects with an error.
   */
  abstract decrypt<Secret>(secret: EncString): Promise<Jsonify<Secret>>;
}
