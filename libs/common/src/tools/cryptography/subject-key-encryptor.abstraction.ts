// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { UserId } from "../../types/guid";

/** An encryption strategy that protects a type's secrets using a key
 *  specific to the subject being encrypted. This strategy is bound to a
 *  specific user and a specific subject within that user's data.
 *
 *  The subject id uniquely identifies the subject being encrypted and is
 *  used to identify the key(s) that perform decryption on behalf of the
 *  subject. This allows the UserStateSubject to grow to support collections
 *  like Record<Guid,T> and Array<T>.
 */
export abstract class SubjectKeyEncryptor {
  /** Identifies the user bound to the encryptor. */
  readonly userId: UserId;

  /** Uniquely identifies the subject being encrypted. This is used to
   *  identify the key(s) that perform decryption on behalf of the subject.
   */
  readonly subjectId: string;

  /** Protects secrets in `value` with a subject-specific key.
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
