import { Observable } from "rxjs";

import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { OrganizationEncryptor } from "./cryptography/organization-encryptor.abstraction";
import { UserEncryptor } from "./cryptography/user-encryptor.abstraction";

/** error emitted when the `SingleUserDependency` changes Ids */
export type UserChangedError = {
  /** the userId pinned by the single user dependency */
  expectedUserId: UserId;
  /** the userId received in error */
  actualUserId: UserId;
};

/** error emitted when the `SingleOrganizationDependency` changes Ids */
export type OrganizationChangedError = {
  /** the organizationId pinned by the single organization dependency */
  expectedOrganizationId: OrganizationId;
  /** the organizationId received in error */
  actualOrganizationId: OrganizationId;
};

/** A pattern for types that depend upon a dynamic policy stream and return
 *  an observable.
 *
 *  Consumers of this dependency should emit when `policy$`
 *  emits, provided that the latest message materially
 *  changes the output of the consumer. If `policy$` emits
 *  an unrecoverable error, the consumer should continue using
 *  the last-emitted policy. If `policy$` completes, the consumer
 *  should continue using the last-emitted policy.
 */
export type PolicyDependency = {
  /** A stream that emits policies when subscribed and
   *  when the policy changes. The stream should not
   *  emit null or undefined.
   */
  policy$: Observable<Policy[]>;
};

/** A pattern for types that depend upon a dynamic userid and return
 *  an observable.
 *
 * Consumers of this dependency should emit when `userId$` changes.
 * If `userId$` completes, the consumer should also complete. If
 * `userId$` emits an unrecoverable error, the consumer should
 * also emit the error.
 */
export type UserDependency = {
  /** A stream that emits a UserId when subscribed and when
   *  the userId changes. The stream should not emit null
   *  or undefined.
   */
  userId$: Observable<UserId>;
};

/** Decorates a type to indicate the user, if any, that the type is usable only by
 *  a specific user.
 */
export type UserBound<K extends keyof any, T> = { [P in K]: T } & {
  /** The user to which T is bound. */
  userId: UserId;
};

/** Decorates a type to indicate the organization, if any, that the type is usable only by
 *  a specific organization.
 */
export type OrganizationBound<K extends keyof any, T> = { [P in K]: T } & {
  /** The organization to which T is bound. */
  organizationId: OrganizationId;
};

/** A pattern for types that depend upon a fixed-key encryptor and return
 *  an observable.
 *
 * Consumers of this dependency should emit a `OrganizationChangedError` if
 * the bound OrganizationId changes or if the encryptor changes. If
 * `singleOrganizationEncryptor$` completes, the consumer should complete
 *  once all events received prior to the completion event are
 *  finished processing. The consumer should, where possible,
 *  prioritize these events in order to complete as soon as possible.
 *  If `singleOrganizationEncryptor$` emits an unrecoverable error, the consumer
 *  should also emit the error.
 */
export type SingleOrganizationEncryptorDependency = {
  /** A stream that emits an encryptor when subscribed and the org key
   *  is available, and completes when the org key is no longer available.
   *  The stream should not emit null or undefined.
   */
  singleOrgEncryptor$: Observable<OrganizationBound<"encryptor", OrganizationEncryptor>>;
};

/** A pattern for types that depend upon a fixed-value organizationId and return
 *  an observable.
 *
 *  Consumers of this dependency should emit a `OrganizationChangedError` if
 *  the value of `singleOrganizationId$` changes. If `singleOrganizationId$` completes,
 *  the consumer should also complete. If `singleOrganizationId$` errors, the
 *  consumer should also emit the error.
 *
 *  @remarks Check the consumer's documentation to determine how it
 *  responds to repeat emissions.
 */
export type SingleOrganizationDependency = {
  /** A stream that emits an organization Id and the user to which it is bound
   *  when subscribed and the user's account is unlocked, and completes when the
   *  account is locked or logged out.
   *  The stream should not emit null or undefined.
   */
  singleOrganizationId$: Observable<UserBound<"organizationId", OrganizationId>>;
};

/** A pattern for types that depend upon a fixed-key encryptor and return
 *  an observable.
 *
 * Consumers of this dependency should emit a `UserChangedError` if
 * the bound UserId changes or if the encryptor changes. If
 * `singleUserEncryptor$` completes, the consumer should complete
 *  once all events received prior to the completion event are
 *  finished processing. The consumer should, where possible,
 *  prioritize these events in order to complete as soon as possible.
 *  If `singleUserEncryptor$` emits an unrecoverable error, the consumer
 *  should also emit the error.
 */
export type SingleUserEncryptorDependency = {
  /** A stream that emits an encryptor when subscribed and the user key
   *  is available, and completes when the user key is no longer available.
   *  The stream should not emit null or undefined.
   */
  singleUserEncryptor$: Observable<UserBound<"encryptor", UserEncryptor>>;
};

/** A pattern for types that depend upon a fixed-value userid and return
 *  an observable.
 *
 *  Consumers of this dependency should emit a `UserChangedError` if
 *  the value of `singleUserId$` changes. If `singleUserId$` completes,
 *  the consumer should also complete. If `singleUserId$` errors, the
 *  consumer should also emit the error.
 *
 *  @remarks Check the consumer's documentation to determine how it
 *  responds to repeat emissions.
 */
export type SingleUserDependency = {
  /** A stream that emits a UserId when subscribed and the user's account
   *  is unlocked, and completes when the account is locked or logged out.
   *  The stream should not emit null or undefined.
   */
  singleUserId$: Observable<UserId>;
};

/** A pattern for types that emit values exclusively when the dependency
 *  emits a message. Set a type parameter when your method requires contextual
 *  information when the request is issued.
 *
 *  Consumers of this dependency should emit when `on$` emits. If `on$`
 *  completes, the consumer should also complete. If `on$`
 *  errors, the consumer should also emit the error.
 *
 *  @remarks This dependency is useful when you have a nondeterministic
 *  or stateful algorithm that you would like to run when an event occurs.
 */
export type OnDependency<T = any> = {
  /** The stream that controls emissions
   */
  on$: Observable<T>;
};

/** A pattern for types that emit when a dependency is `true`.
 *
 *  Consumers of this dependency may emit when `when$` emits a true
 *  value. If `when$` completes, the consumer should also complete. If
 * `when$` errors, the consumer should also emit the error.
 *
 *  @remarks Check the consumer's documentation to determine how it
 *  responds to emissions.
 */
export type WhenDependency = {
  /** The stream to observe for true emissions. */
  when$: Observable<boolean>;
};

/** A pattern for types that allow their managed settings to
 *  be overridden.
 *
 *  Consumers of this dependency should emit when `settings$`
 *  change. If `settings$` completes, the consumer should also
 *  complete. If `settings$` errors, the consumer should also
 *  emit the error.
 */
export type SettingsDependency<Settings> = {
  /** A stream that emits settings when settings become available
   *  and when they change. If the settings are not available, the
   *  stream should wait to emit until they become available.
   */
  settings$: Observable<Settings>;
};

/** A pattern for types that accept an arbitrary dependency and
 *  inject it into behavior-customizing functions.
 *
 *  Unlike most other dependency types, this interface does not
 *  functionally constrain the behavior of the consumer.
 *
 *  @remarks Consumers of this dependency wholly determine
 *  their response. Check the consumer's documentation
 *  to find this information.
 */
export type Dependencies<TCombine> = {
  dependencies$: Observable<TCombine>;
};
