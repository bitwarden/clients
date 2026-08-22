// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { UserId } from "../../types/guid";

import { SubjectKeyEncryptor } from "./subject-key-encryptor.abstraction";
import { UserEncryptor } from "./user-encryptor.abstraction";

/** A classification strategy that protects a type's secrets by encrypting them
 *  with the user key. The user key is provided by a UserEncryptor.
 *
 *  This encryptor delegates encryption and decryption to a UserEncryptor while
 *  adding a subject id that uniquely identifies the subject being encrypted.
 *  This allows the UserStateSubject to grow to support collections like
 *  Record<Guid,T> and Array<T> in the future, as subject-specific keys can
 *  be rotated independently.
 */
export class UserSubjectKeyEncryptor extends SubjectKeyEncryptor {
  /** Instantiates the encryptor
   *  @param userId identifies the user bound to the encryptor.
   *  @param subjectId uniquely identifies the subject being encrypted within the user's data.
   *  @param userEncryptor the underlying user encryptor that provides the key material.
   *    The UserKeyEncryptor should be given to this class so that the keys need not
   *    be adjacent to each other.
   */
  constructor(
    readonly userId: UserId,
    readonly subjectId: string,
    private readonly userEncryptor: UserEncryptor,
  ) {
    super();
    this.assertHasValue("userId", userId);
    this.assertHasValue("subjectId", subjectId);
    this.assertHasValue("userEncryptor", userEncryptor);
  }

  async encrypt<Secret>(secret: Jsonify<Secret>): Promise<EncString> {
    return this.userEncryptor.encrypt(secret);
  }

  async decrypt<Secret>(secret: EncString): Promise<Jsonify<Secret>> {
    return this.userEncryptor.decrypt(secret);
  }

  private assertHasValue(name: string, value: any) {
    if (value === undefined || value === null) {
      throw new Error(`${name} cannot be null or undefined`);
    }
  }
}
