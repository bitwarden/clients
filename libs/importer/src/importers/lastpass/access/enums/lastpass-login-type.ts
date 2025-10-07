/**
 * Represents LastPass login types.
 */
export const LastpassLoginType = Object.freeze({
  MasterPassword: 0,
  // Not sure what Types 1 and 2 are?
  Federated: 3,
} as const);

/**
 * Type representing valid LastPass login type values.
 */
export type LastpassLoginType = (typeof LastpassLoginType)[keyof typeof LastpassLoginType];

const namesByLastpassLoginType = new Map<LastpassLoginType, keyof typeof LastpassLoginType>(
  Object.entries(LastpassLoginType).map(([key, value]) => [
    value,
    key as keyof typeof LastpassLoginType,
  ]),
);

/**
 * Checks if a value is a valid LastpassLoginType.
 * @param value - The value to check.
 * @returns True if the value is a valid LastpassLoginType, false otherwise.
 */
export function isLastpassLoginType(value: unknown): value is LastpassLoginType {
  return namesByLastpassLoginType.has(value as LastpassLoginType);
}

/**
 * Converts a value to a LastpassLoginType if it is valid.
 * @param value - The value to convert.
 * @returns The value as a LastpassLoginType if valid, otherwise undefined.
 */
export function asLastpassLoginType(value: unknown): LastpassLoginType | undefined {
  return isLastpassLoginType(value) ? (value as LastpassLoginType) : undefined;
}

/**
 * Gets the name of a LastpassLoginType value.
 * @param value - The LastpassLoginType value to get the name for.
 * @returns The name of the LastpassLoginType value, or undefined if not found.
 */
export function nameOfLastpassLoginType(
  value: LastpassLoginType,
): keyof typeof LastpassLoginType | undefined {
  return namesByLastpassLoginType.get(value);
}
