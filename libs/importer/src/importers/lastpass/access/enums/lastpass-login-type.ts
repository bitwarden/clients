// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum LastpassLoginType {
  MasterPassword = 0,
  // Not sure what Types 1 and 2 are?
  Federated = 3,
}

/**
 * Represents LastPass login types.
 */
export const LastpassLoginTypes = Object.freeze({
  MasterPassword: 0,
  // Not sure what Types 1 and 2 are?
  Federated: 3,
} as const);

/**
 * Type representing valid LastPass login type values.
 */
export type LastpassLoginTypeType = (typeof LastpassLoginTypes)[keyof typeof LastpassLoginTypes];

const namesByLastpassLoginType = new Map<LastpassLoginTypeType, keyof typeof LastpassLoginTypes>(
  Object.entries(LastpassLoginTypes).map(([key, value]) => [
    value,
    key as keyof typeof LastpassLoginTypes,
  ]),
);

/**
 * Checks if a value is a valid LastpassLoginTypeType.
 * @param value - The value to check.
 * @returns True if the value is a valid LastpassLoginTypeType, false otherwise.
 */
export function isLastpassLoginTypeType(value: unknown): value is LastpassLoginTypeType {
  return namesByLastpassLoginType.has(value as LastpassLoginTypeType);
}

/**
 * Converts a value to a LastpassLoginTypeType if it is valid.
 * @param value - The value to convert.
 * @returns The value as a LastpassLoginTypeType if valid, otherwise undefined.
 */
export function asLastpassLoginTypeType(value: unknown): LastpassLoginTypeType | undefined {
  return isLastpassLoginTypeType(value) ? (value as LastpassLoginTypeType) : undefined;
}

/**
 * Gets the name of a LastpassLoginTypeType value.
 * @param value - The LastpassLoginTypeType value to get the name for.
 * @returns The name of the LastpassLoginTypeType value, or undefined if not found.
 */
export function nameOfLastpassLoginTypeType(
  value: LastpassLoginTypeType,
): keyof typeof LastpassLoginTypes | undefined {
  return namesByLastpassLoginType.get(value);
}
