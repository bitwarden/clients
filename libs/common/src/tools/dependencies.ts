import { Observable } from "rxjs";

import { OrganizationId, UserId } from "../types/guid";

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

/** A pattern for types that depend upon the lifetime of a fixed dependency.
 *  The dependency's lifetime is tracked through the observable. The observable
 *  emits the dependency once it becomes available and completes when the
 *  dependency becomes unavailable.
 *
 *  Consumers of this dependency should emit a `SequenceError` if the dependency emits
 *  multiple times. When the dependency completes, the consumer should also
 *  complete. When the dependency errors, the consumer should also error.
 */
export type BoundDependency<Name extends string, T> = {
  /** A stream that emits a dependency once it becomes available
   *  and completes when the dependency becomes unavailable. The stream emits
   *  only once per subscription and never emits null or undefined.
   */
  [K in `${Name}$`]: Observable<T>;
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
