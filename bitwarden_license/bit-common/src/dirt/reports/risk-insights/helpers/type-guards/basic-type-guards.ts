// I'm leaving this here as an example of further improvements we can make to check types
// We can define a nominal type for PositiveSafeNumber to enhance type safety
// const POSITIVE_SAFE_NUMBER_SYMBOL: unique symbol = Symbol("POSITIVE_SAFE_NUMBER");

// This file sets up basic types and guards for values we expect from decrypted data

// Basic types
export type BoundedString = string;
export type BoundedStringOrNull = BoundedString | null;
export type BoundedStringOrUndefined = BoundedString | undefined;
export type PositiveSafeNumber = number;
export type BoundedArray<T> = T[];
export type DateOrNull = Date | null;
export type DateString = string;
export type DateStringOrNull = DateString | null;
export type DateStringOrUndefined = DateString | undefined;

// Constants
/**
 * Security limits for validation (prevent DoS attacks and ensure reasonable data sizes)
 */
export const BOUNDED_STRING_MAX_LENGTH = 1000; // Reasonable limit for names, emails, GUIDs
export const BOUNDED_ARRAY_MAX_LENGTH = 50000; // Reasonable limit for report arrays
export const BOUNDED_NUMBER_MAX_COUNT = 10000000; // 10 million - reasonable upper bound for count fields

// Type guard methods
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isBoundedPositiveNumber(value: unknown): value is PositiveSafeNumber {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= BOUNDED_NUMBER_MAX_COUNT
  );
}

export function isBoundedPositiveNumberOrUndefined(
  value: unknown,
): value is PositiveSafeNumber | undefined {
  return value === undefined || isBoundedPositiveNumber(value);
}

export function isBoundedString(value: unknown): value is BoundedString {
  return typeof value === "string" && value.length > 0 && value.length <= BOUNDED_STRING_MAX_LENGTH;
}

export function isBoundedStringOrNull(value: unknown): value is BoundedStringOrNull {
  return value == null || isBoundedString(value);
}

export function isBoundedStringOrUndefined(value: unknown): value is BoundedStringOrUndefined {
  return value === undefined || isBoundedString(value);
}

export const isBoundedStringArray = createBoundedArrayGuard(isBoundedString);

export function isBoundedArray<T>(arr: unknown): arr is BoundedArray<T> {
  return Array.isArray(arr) && arr.length < BOUNDED_ARRAY_MAX_LENGTH;
}

/**
 * A type guard to check if a value is a plain object with string keys and boolean values
 * @param value The value to check
 * @returns True if the value is a Record<string, boolean>, false otherwise
 */
export function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value as object);
  if (entries.length > BOUNDED_ARRAY_MAX_LENGTH) {
    return false;
  }
  return entries.every(([k, v]) => isBoundedString(k) && isBoolean(v));
}

/**
 * A type guard to check if a value is a valid Date object
 * @param value The value to check
 * @returns True if the value is a valid Date object, false otherwise
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * A type guard to check if a value is a valid Date object or null
 * @param value The value to check
 * @returns True if the value is a valid Date object, false otherwise
 */
export function isDateOrNull(value: unknown): value is DateOrNull {
  return value === null || isDate(value);
}

/**
 * A type guard to check if a value is a valid date string
 * This also checks that the string value can be correctly parsed into a valid Date object
 * @param value The value to check
 * @returns True if the value is a valid date string, false otherwise
 */
export function isDateString(value: unknown): value is DateString {
  if (typeof value !== "string") {
    return false;
  }

  // Attempt to create a Date object from the string.
  const date = new Date(value);

  // Return true only if the string produced a valid date.
  // We use `getTime()` to check for validity, as `new Date('invalid')` returns `NaN` for its time value.
  return !isNaN(date.getTime());
}

/**
 * A type guard to check if a value is a valid date string or null
 * This also checks that the string value can be correctly parsed into a valid Date object
 * @param value The value to check
 * @returns True if the value is a valid date string or null, false otherwise
 */
export function isDateStringOrNull(value: unknown): value is DateStringOrNull {
  return value === null || isDateString(value);
}

/**
 * A type guard to check if a value is a valid date string or undefined (absent field).
 * Use this for optional date fields where the key may be absent from JSON-parsed objects.
 * @param value The value to check
 * @returns True if the value is undefined or a valid date string, false otherwise
 */
export function isDateStringOrUndefined(value: unknown): value is DateStringOrUndefined {
  return value === undefined || isDateString(value);
}

/**
 * A higher-order function that takes a type guard for T and returns a
 * new type guard for an array of T.
 */
export function createBoundedArrayGuard<T>(isType: (item: unknown) => item is T) {
  return function (arr: unknown): arr is T[] {
    return isBoundedArray(arr) && arr.every(isType);
  };
}

type TempObject = Record<PropertyKey, unknown>;

/**
 * Describes the type/shape of a value without exposing actual content.
 * Safe to include in logs — never reveals PII or vault data.
 */
function describeType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    return "object";
  }
  return typeof value; // "string", "number", "boolean"
}

/**
 * Checks that obj is a plain JSON-parsed object (not null, not a class instance,
 * not a prototype-polluted object).
 * Returns null if the structure is valid, or a diagnostic string if not.
 */
function checkStructure(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return `expected plain object, got ${describeType(obj)}`;
  }

  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    return "rejected: non-plain object (class instance or Object.create(null))";
  }

  // Prevent dangerous properties that could be used for prototype pollution
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return `rejected: prototype pollution attempt via key "${key}"`;
    }
  }

  return null;
}

/**
 * A type guard function with an attached `.explain()` method.
 * The guard itself behaves identically to a standard type predicate.
 * `.explain()` returns an array of diagnostic messages describing which fields
 * failed validation — safe to include in logs (never exposes actual values, only types).
 */
export type EnhancedGuard<T> = ((obj: unknown) => obj is T) & {
  explain: (obj: unknown) => string[];
};

/**
 * Factory that creates a type-safe object validator from a map of per-field guards.
 *
 * Pass a `{ fieldName: typeGuardFn }` map and receive a single function that validates
 * a plain JSON-parsed object against all listed fields. The returned validator:
 * - Rejects non-plain-objects (arrays, class instances, null)
 * - Blocks prototype pollution via `__proto__` / `constructor` / `prototype`
 * - For each field in the map: if the field is **absent** from the object, passes
 *   `undefined` to the guard — required fields fail naturally (e.g. `isBoundedString(undefined)
 *   → false`), optional fields pass if their guard accepts `undefined`
 *   (e.g. `isDateStringOrUndefined(undefined) → true`)
 *
 * The returned `EnhancedGuard<T>` also exposes an `.explain(value)` method that returns
 * field-level diagnostic messages (which fields failed and what type was received).
 *
 * @example
 * ```typescript
 * // All required fields — key must be present and pass its guard
 * const isMemberEntry = createValidator<MemberRegistryEntryData>({
 *   id: isBoundedString,
 *   userName: isBoundedStringOrNull,   // present, but may be null
 *   email: isBoundedString,
 * });
 *
 * // Mixed required and optional fields — optional fields use an *OrUndefined guard
 * const isReportEntry = createValidator<ApplicationHealthData>({
 *   applicationName: isBoundedString,  // required
 *   memberRefs: isBooleanRecord,        // required
 *   iconUri: isBoundedStringOrUndefined, // optional — key may be absent
 * });
 * ```
 */
export function createValidator<T>(validators: {
  [K in keyof T]: (value: unknown) => value is T[K];
}): EnhancedGuard<T> {
  const keys = Object.keys(validators) as (keyof T)[];

  const guard = function (obj: unknown): obj is T {
    if (checkStructure(obj) !== null) {
      return false;
    }

    // Type cast to TempObject for key checks
    const tempObj = obj as TempObject;

    // Commenting out for compatibility of removed keys from data
    // Leaving the code commented for now for further discussion
    // Check for unexpected properties
    // const actualKeys = Object.keys(tempObj);
    // const expectedKeys = new Set(keys as string[]);
    // if (actualKeys.some((key) => !expectedKeys.has(key))) {
    //   return false;
    // }

    // For each field in the validator map, pass the value (or `undefined` if absent) to
    // its guard. Required guards (e.g. isBoundedString) reject undefined naturally;
    // optional guards (e.g. isBoundedStringOrUndefined) accept it.
    return keys.every((key) => {
      const value = key in tempObj ? tempObj[key] : undefined;
      return validators[key](value);
    });
  };

  guard.explain = function (obj: unknown): string[] {
    const structuralError = checkStructure(obj);
    if (structuralError !== null) {
      return [structuralError];
    }

    const tempObj = obj as TempObject;
    const failures: string[] = [];

    for (const key of keys) {
      const value = key in tempObj ? tempObj[key] : undefined;
      if (!validators[key](value)) {
        const nestedExplain = (validators[key] as EnhancedGuard<unknown>).explain;
        if (typeof nestedExplain === "function") {
          const nested = nestedExplain(value);
          failures.push(...nested.map((e) => `field '${String(key)}': ${e}`));
        } else {
          failures.push(
            `field '${String(key)}': guard ${validators[key].name || "(anonymous)"} failed — got ${describeType(value)}`,
          );
        }
      }
    }

    return failures;
  };

  return guard;
}

/**
 * A higher-order function that takes an EnhancedGuard for T and returns an
 * EnhancedGuard for T[], with element-level diagnostics in `.explain()`.
 * Use this instead of createBoundedArrayGuard when you need recursive diagnostics.
 */
export function createEnhancedBoundedArrayGuard<T>(isType: EnhancedGuard<T>): EnhancedGuard<T[]> {
  const guard = function (value: unknown): value is T[] {
    return Array.isArray(value) && value.length <= BOUNDED_ARRAY_MAX_LENGTH && value.every(isType);
  };
  guard.explain = function (value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [`expected array, got ${describeType(value)}`];
    }
    if (value.length > BOUNDED_ARRAY_MAX_LENGTH) {
      return [`array length ${value.length} exceeds max ${BOUNDED_ARRAY_MAX_LENGTH}`];
    }
    const errors: string[] = [];
    value.forEach((item, index) => {
      if (!isType(item)) {
        const fieldErrors = isType.explain(item);
        errors.push(...fieldErrors.map((e) => `[${index}]: ${e}`));
      }
    });
    return errors;
  };
  return guard;
}

/**
 * A higher-order function that takes an EnhancedGuard for T and returns an
 * EnhancedGuard for Record<string, T>, with entry-level diagnostics in `.explain()`.
 * Use this for dynamic-key dictionaries (e.g. member registries keyed by user GUID).
 */
export function createBoundedRecordGuard<T>(
  isValue: EnhancedGuard<T>,
): EnhancedGuard<Record<string, T>> {
  const guard = function (value: unknown): value is Record<string, T> {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const entries = Object.entries(value as object);
    if (entries.length > BOUNDED_ARRAY_MAX_LENGTH) {
      return false;
    }
    return entries.every(([k, v]) => isBoundedString(k) && isValue(v));
  };
  guard.explain = function (value: unknown): string[] {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return [`expected plain object, got ${describeType(value)}`];
    }
    const entries = Object.entries(value as object);
    if (entries.length > BOUNDED_ARRAY_MAX_LENGTH) {
      return [`record length ${entries.length} exceeds max ${BOUNDED_ARRAY_MAX_LENGTH}`];
    }
    const errors: string[] = [];
    for (const [k, v] of entries) {
      if (!isBoundedString(k)) {
        errors.push(`key: invalid — got ${describeType(k)}`);
      } else if (!isValue(v)) {
        const fieldErrors = isValue.explain(v);
        errors.push(...fieldErrors.map((e) => `["${k}"]: ${e}`));
      }
    }
    return errors;
  };
  return guard;
}
