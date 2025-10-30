// I'm leaving this here as an example of further improvements we can make to check types
// We can define a nominal type for PositiveSafeNumber to enhance type safety
// const POSITIVE_SAFE_NUMBER_SYMBOL: unique symbol = Symbol("POSITIVE_SAFE_NUMBER");

// This file sets up basic types and guards for values we expect from decrypted data

// Basic types
export type BoundedString = string;
export type BoundedStringOrNull = BoundedString | null;
export type PositiveSafeNumber = number;
export type BoundedArray<T> = T[];
export type DateOrNull = Date | null;
export type DateString = string;
export type DateStringOrNull = DateString | null;

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

export function isBoundedString(value: unknown): value is BoundedString {
  return typeof value === "string" && value.length > 0 && value.length <= BOUNDED_STRING_MAX_LENGTH;
}

export function isBoundedStringOrNull(value: unknown): value is BoundedStringOrNull {
  return value == null || isBoundedString(value);
}

export const isBoundedStringArray = createBoundedArrayGuard(isBoundedString);

export function isBoundedArray<T>(arr: unknown): arr is BoundedArray<T> {
  return Array.isArray(arr) && arr.length < BOUNDED_ARRAY_MAX_LENGTH;
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
 *
 * @param validators
 * @returns
 */
export function createValidator<T>(validators: {
  [K in keyof T]: (value: unknown) => value is T[K];
}): (obj: unknown) => obj is T {
  const keys = Object.keys(validators) as (keyof T)[];

  return function (obj: unknown): obj is T {
    if (typeof obj !== "object" || obj === null) {
      return false;
    }

    if (Object.getPrototypeOf(obj) !== Object.prototype) {
      return false;
    }

    // Prevent dangerous properties that could be used for prototype pollution
    // Check for __proto__, constructor, and prototype as own properties
    const dangerousKeys = ["__proto__", "constructor", "prototype"];
    for (const key of dangerousKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return false;
      }
    }

    // Type cast to TempObject for key checks
    const tempObj = obj as TempObject;

    // Check for unexpected properties
    const actualKeys = Object.keys(tempObj);
    const expectedKeys = new Set(keys as string[]);
    if (actualKeys.some((key) => !expectedKeys.has(key))) {
      return false;
    }

    // Check for each property's existence and type
    return keys.every((key) => {
      // Use 'in' to check for property existence before accessing it
      if (!(key in tempObj)) {
        return false;
      }
      // Pass the value to its specific validator
      return validators[key](tempObj[key]);
    });
  };
}
