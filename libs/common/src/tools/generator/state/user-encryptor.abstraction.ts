import { Jsonify } from "type-fest";

import { EncString } from "../../../platform/models/domain/enc-string";
import { UserId } from "../../../types/guid";

/** A classification strategy that protects a type's secrets with
 *  user-specific information. The specific kind of information is
 *  determined by the classification strategy.
 */
export abstract class UserEncryptor<Secret> {
  /** Protects secrets in `value` with a user-specific key.
   *  @param secret the object to protect. This object is mutated during encryption.
   *  @param userId identifies the user-specific information used to protect
   *    the secret.
   *  @returns a promise that resolves to a tuple. The tuple's first property contains
   *    the encrypted secret and whose second property contains an object w/ disclosed
   *    properties.
   *   @throws If `value` is `null` or `undefined`, the promise rejects with an error.
   */
  abstract encrypt(secret: Secret, userId: UserId): Promise<EncString>;

  /** Combines protected secrets and disclosed data into a type that can be
   *  rehydrated into a domain object.
   *  @param secret an encrypted JSON payload containing encrypted secrets.
   *  @param userId identifies the user-specific information used to protect
   *    the secret.
   *  @returns a promise that resolves to the raw state. This state *is not* a
   *    class. It contains only data that can be round-tripped through JSON,
   *    and lacks members such as a prototype or bound functions.
   *  @throws If `secret` or `disclosed` is `null` or `undefined`, the promise
   *    rejects with an error.
   */
  abstract decrypt(secret: EncString, userId: UserId): Promise<Jsonify<Secret>>;
}
