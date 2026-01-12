// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString } from "../../key-management/crypto/models/enc-string";
import { OrganizationId } from "../../types/guid";

/** An encryption strategy that protects a type's secrets with
 *  organization-specific keys. This strategy is bound to a specific organization.
 */
export abstract class OrganizationEncryptor {
  /** Identifies the organization bound to the encryptor. */
  readonly organizationId: OrganizationId;

  /** Protects secrets in `value` with an organization-specific key.
   *  @param secret the object to protect. This object is mutated during encryption.
   *  @returns a promise that resolves to a tuple. The tuple's first property contains
   *    the encrypted secret and whose second property contains an object w/ disclosed
   *    properties.
   *   @throws If `value` is `null` or `undefined`, the promise rejects with an error.
   */
  abstract encrypt<Secret>(secret: Jsonify<Secret>): Promise<EncString>;

  /** Combines protected secrets and disclosed data into a type that can be
   *  rehydrated into a domain object.
   *  @param secret an encrypted JSON payload containing encrypted secrets.
   *  @returns a promise that resolves to the raw state. This state *is not* a
   *    class. It contains only data that can be round-tripped through JSON,
   *    and lacks members such as a prototype or bound functions.
   *  @throws If `secret` or `disclosed` is `null` or `undefined`, the promise
   *    rejects with an error.
   */
  abstract decrypt<Secret>(secret: EncString): Promise<Jsonify<Secret>>;
}
