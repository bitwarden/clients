// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Constraint } from "@bitwarden/common/tools/types";

import { sum } from "../util";

const Zero: Constraint<number> = { min: 0, max: 0 };
const AtLeastOne: Constraint<number> = { min: 1 };
const RequiresTrue: Constraint<boolean> = { requiredValue: true };

/** Ensures the minimum and maximum bounds of a constraint are at least as large as the
 *  combined minimum bounds of `dependencies`.
 *  @param current the constraint extended by the combinator.
 *  @param dependencies the constraints summed to determine the bounds of `current`.
 *  @returns a copy of `current` with the new bounds applied.
 *
 */
function atLeastSum(current: Constraint<number>, dependencies: Constraint<number>[]) {
  // length must be at least as long as the required character set
  const minConsistentLength = sum(...dependencies.map((c) => c?.min));
  const minLength = Math.max(current?.min ?? 0, minConsistentLength);
  const length = atLeast(minLength, current);

  return length;
}

/** Extends a constraint with a readonly field.
 *  @param readonly Adds a readonly field when this is `true`.
 *  @param constraint the constraint extended by the combinator.
 *  @returns a copy of `constraint` with the readonly constraint applied as-needed.
 */
function maybeReadonly(readonly: boolean, constraint?: Constraint<boolean>): Constraint<boolean> {
  if (!readonly) {
    return constraint;
  }

  const result: Constraint<boolean> = Object.assign({}, constraint ?? {});
  result.readonly = true;

  return result;
}

/** Conditionally enables a constraint.
 *  @param enabled the condition to evaluate
 *  @param constraint the condition to conditionally enable
 *  @returns `constraint` when `enabled` is true. Otherwise returns `undefined.
 */
function maybe<T>(enabled: boolean, constraint: Constraint<T>): Constraint<T> {
  return enabled ? constraint : undefined;
}

// copies `constraint`; ensures both bounds >= value
/** Ensures the boundaries of a constraint are at least equal to the minimum.
 *  @param minimum the lower bound of the constraint. When this is `undefined` or `null`,
 *   the method returns `constraint`.
 *  @param constraint the constraint to evaluate. When this is `undefined` or `null`,
 *   the method creates a new constraint.
 *  @returns a copy of `constraint`. When `minimum` has a value, the returned constraint
 *   always includes a minimum bound. When `constraint` has a maximum defined, both
 *   its minimum and maximum are checked against `minimum`.
 */
function atLeast(minimum: number, constraint?: Constraint<number>): Constraint<number> {
  if (minimum === undefined || minimum === null) {
    return constraint;
  }

  const atLeast = { ...(constraint ?? {}) };
  atLeast.min = Math.max(atLeast.min ?? -Infinity, minimum);

  if ("max" in atLeast) {
    atLeast.max = Math.max(atLeast.max, minimum);
  }

  return atLeast;
}

/** Ensures a value falls within the minimum and maximum boundaries of a constraint.
 *  @param value the value to check. Nullish values are coerced to 0.
 *  @param constraint the constraint to evaluate against.
 *  @returns If the value is below the minimum constraint, the minimum bound is
 *   returned. If the value is above the maximum constraint, the maximum bound is
 *   returned. Otherwise, the value is returned.
 */
function fitToBounds(value: number, constraint: Constraint<number>) {
  if (!constraint) {
    return value;
  }

  const { min, max } = constraint;

  const withUpperBound = Math.min(value ?? 0, max ?? Infinity);
  const withLowerBound = Math.max(withUpperBound, min ?? -Infinity);

  return withLowerBound;
}

/** Fits the length of a string within the minimum and maximum length boundaries
 *  of a constraint.
 *  @param value the value to check. Nullish values are coerced to the empty string.
 *  @param constraint the constraint to evaluate against.
 *  @param options.fillString a string to fill values from. Defaults to a space.
 *   When fillString contains multiple characters, each is filled in order. The
 *   fill string repeats when it gets to the end of the string and there are
 *   more characters to fill.
 *  @returns If the value is below the required length, returns a copy padded
 *   by the fillString. If the value is above the required length, returns a copy
 *   padded to the maximum length.
 * */
function fitLength(
  value: string,
  constraint: Constraint<string>,
  options?: { fillString?: string },
) {
  if (!constraint) {
    return value;
  }

  const { minLength, maxLength } = constraint;
  const { fillString } = options ?? { fillString: " " };

  const trimmed = (value ?? "").slice(0, maxLength ?? Infinity);
  const result = trimmed.padEnd(minLength ?? trimmed.length, fillString);

  return result;
}

/** Enforces a readonly field has a required value.
 *  @param value the value to check.
 *  @param constraint the constraint to evaluate against.
 *  @returns If the constraint's readonly field is `true`, returns the
 *   constraint's required value or `undefined` if none is specified.
 *   Otherwise returns the value.
 *  @remarks This method can be used to ensure a conditionally-calculated
 *   field becomes undefined. Simply specify `readonly` without a `requiredValue`
 *   then use `??` to perform the calculation.
 */
function enforceConstant(value: boolean, constraint: Constraint<boolean>) {
  if (constraint?.readonly) {
    return constraint.requiredValue;
  } else {
    return value;
  }
}

/** Conditionally create a readonly true value.
 *  @param enabled When true, create the value.
 *  @returns When enabled is true, a readonly constraint with a constant value
 *  of `true`. Otherwise returns `undefined`.
 */
function readonlyTrueWhen(enabled: boolean) {
  const readonlyValue = maybeReadonly(enabled, RequiresTrue);
  const maybeReadonlyValue = maybe(enabled, readonlyValue);
  return maybeReadonlyValue;
}

export {
  atLeast,
  atLeastSum,
  maybe,
  maybeReadonly,
  fitToBounds,
  enforceConstant,
  readonlyTrueWhen,
  fitLength,
  Zero,
  AtLeastOne,
  RequiresTrue,
};
