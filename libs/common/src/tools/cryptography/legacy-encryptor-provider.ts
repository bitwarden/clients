// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import {
  OrganizationBound,
  SingleOrganizationDependency,
  SingleUserDependency,
  UserBound,
} from "../dependencies";

import { OrganizationEncryptor } from "./organization-encryptor.abstraction";
import { UserEncryptor } from "./user-encryptor.abstraction";

/** Creates encryptors
 *  @deprecated this logic will soon be replaced with a design that provides for
 *    key rotation. Use it at your own risk
 */
export abstract class LegacyEncryptorProvider {
  /** Retrieves an encryptor populated with the user's most recent key instance that
   *  uses a padded data packer to encode data.
   *  @param frameSize length of the padded data packer's frames.
   *  @param dependencies.singleUserId$ identifies the user to which the encryptor is bound
   *  @returns an observable that emits when the key becomes available and completes
   *    when the key becomes unavailable.
   */
  userEncryptor$: (
    frameSize: number,
    dependencies: SingleUserDependency,
  ) => Observable<UserBound<"encryptor", UserEncryptor>>;

  /** Retrieves an encryptor populated with the organization's most recent key instance that
   *  uses a padded data packer to encode data.
   *  @param frameSize length of the padded data packer's frames.
   *  @param dependencies.singleOrganizationId$ identifies the user/org combination
   *   to which the encryptor is bound.
   *  @returns an observable that emits when the key becomes available and completes
   *    when the key becomes unavailable.
   */
  organizationEncryptor$: (
    frameSize: number,
    dependences: SingleOrganizationDependency,
  ) => Observable<OrganizationBound<"encryptor", OrganizationEncryptor>>;
}
