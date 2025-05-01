import { Simplify } from "type-fest";

import { IntegrationId } from "./integration";

/** Constraints that are shared by all primitive field types */
type PrimitiveConstraint = {
  /** `true` indicates the field is required; otherwise the field is optional */
  required?: boolean;

  /** `true` indicates the field is immutable; otherwise the field is mutable */
  readonly?: boolean;
};

/** Constraints that are shared by string fields */
type StringConstraints = {
  /** minimum string length. When absent, min length is 0. */
  minLength?: number;

  /** maximum string length. When absent, max length is unbounded. */
  maxLength?: number;
};

/** Constraints that are shared by number fields */
type NumberConstraints = {
  /** minimum number value. When absent, min value is unbounded. */
  min?: number;

  /** maximum number value. When absent, min value is unbounded. */
  max?: number;

  /** recommended value. This is the value bitwarden recommends
   *  to the user as an appropriate value.
   */
  recommendation?: number;

  /** requires the number be a multiple of the step value;
   *  this field must be a positive number. +0 and Infinity are
   *  prohibited. When absent, any number is accepted.
   * @remarks set this to `1` to require integer values.
   */
  step?: number;
};

/** Constraints that are shared by boolean fields */
type BooleanConstraint = {
  /** When present, the boolean field must have the set value.
   *  When absent or undefined, the boolean field's value is unconstrained.
   */
  requiredValue?: boolean;
};

/** Utility type that transforms a type T into its supported validators.
 */
export type Constraint<T> = PrimitiveConstraint &
  (T extends string
    ? StringConstraints
    : T extends number
      ? NumberConstraints
      : T extends boolean
        ? BooleanConstraint
        : never);

/** Utility type that transforms keys of T into their supported
 *  validators.
 */
export type Constraints<T> = {
  [Key in keyof T]?: Simplify<Constraint<T[Key]>>;
};

/** Utility type that tracks whether a set of constraints was
 *  produced by an active policy.
 */
export type PolicyConstraints<T> = {
  /** When true, the constraints were derived from an active policy. */
  policyInEffect?: boolean;
} & Constraints<T>;

/** utility type for methods that evaluate constraints generically. */
export type AnyConstraint = PrimitiveConstraint &
  StringConstraints &
  NumberConstraints &
  BooleanConstraint;

/** Extends state message with constraints that apply to the message. */
export type WithConstraints<State> = {
  /** the state */
  readonly state: State;

  /** the constraints enforced upon the type. */
  readonly constraints: Constraints<State>;
};

/** Creates constraints that are applied automatically to application
 *  state.
 *  This type is mutually exclusive with `StateConstraints`.
 */
export type DynamicStateConstraints<State> = {
  /** Creates constraints with data derived from the input state
   *  @param state the state from which the constraints are initialized.
   *  @remarks this is useful for calculating constraints that
   *   depend upon values from the input state. You should not send these
   *   constraints to the UI, because that would prevent the UI from
   *   offering less restrictive constraints.
   */
  calibrate: (state: State) => StateConstraints<State>;
};

/** Constraints that are applied automatically to application state.
 *  This type is mutually exclusive with `DynamicStateConstraints`.
 *  @remarks this type automatically corrects incoming our outgoing
 *   data. If you would like to prevent invalid data from being
 *   applied, use an rxjs filter and evaluate `Constraints<State>`
 *   instead.
 */
export type StateConstraints<State> = {
  /** Well-known constraints of `State` */
  readonly constraints: Readonly<Constraints<State>>;

  /** Enforces constraints that always hold for the emitted state.
   *  @remarks This is useful for enforcing "override" constraints,
   *   such as when a policy requires a value fall within a specific
   *   range.
   *  @param state the state pending emission from the subject.
   *  @return the value emitted by the subject
   */
  adjust: (state: State) => State;

  /** Enforces constraints that holds when the subject completes.
   *  @remarks This is useful for enforcing "default" constraints,
   *   such as when a policy requires some state is true when data is
   *   first subscribed, but the state may vary thereafter.
   *  @param state the state of the subject immediately before
   *   completion.
   *  @return the value stored to state upon completion.
   */
  fix: (state: State) => State;
};

export type SubjectConstraints<T> = StateConstraints<T> | DynamicStateConstraints<T>;

/** Options that provide contextual information about the application state
 *  when a generator is invoked.
 */
export type VaultItemRequest = {
  /** The domain of the website the requested credential is used
   *  within. This should be set to `null` when the request is not specific
   *  to any website.
   *  @remarks this field contains sensitive data
   */
  website: string | null;
};

/** Options that provide contextual information about the application state
 *  when a generator is invoked.
 */
export type GenerationRequest = Partial<VaultItemRequest> &
  Partial<{
    integration: IntegrationId | null;
  }>;
