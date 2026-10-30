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
import { SubjectKeyEncryptor } from "./subject-key-encryptor.abstraction";
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

  /** Retrieves an encryptor bound to a specific subject within the user's data.
   *  The encryptor uses a padded data packer to encode data and is identified
   *  by a subject id that uniquely identifies the subject being encrypted.
   *  @param frameSize length of the padded data packer's frames.
   *  @param subjectId uniquely identifies the subject being encrypted within the user's data.
   *  @param dependencies.singleUserId$ identifies the user to which the encryptor is bound
   *  @returns an observable that emits when the key becomes available and completes
   *    when the key becomes unavailable.
   */
  subjectEncryptor$: (
    frameSize: number,
    subjectId: string,
    dependencies: SingleUserDependency,
  ) => Observable<UserBound<"encryptor", SubjectKeyEncryptor>>;

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
