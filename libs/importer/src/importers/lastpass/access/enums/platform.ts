// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum Platform {
  Desktop,
  Mobile,
}

/**
 * Platform types representing different device categories.
 */
export const Platforms = Object.freeze({
  Desktop: 0,
  Mobile: 1,
} as const);

/**
 * Type representing valid platform values.
 */
export type PlatformType = (typeof Platforms)[keyof typeof Platforms];

const namesByPlatform = new Map<PlatformType, keyof typeof Platforms>(
  Object.entries(Platforms).map(([key, value]) => [value, key as keyof typeof Platforms]),
);

/**
 * Checks if a value is a valid PlatformType.
 * @param value - The value to check.
 * @returns True if the value is a valid PlatformType, false otherwise.
 */
export function isPlatformType(value: unknown): value is PlatformType {
  return namesByPlatform.has(value as PlatformType);
}

/**
 * Converts a value to a PlatformType if it is valid.
 * @param value - The value to convert.
 * @returns The value as a PlatformType if valid, otherwise undefined.
 */
export function asPlatformType(value: unknown): PlatformType | undefined {
  return isPlatformType(value) ? (value as PlatformType) : undefined;
}

/**
 * Gets the name of a PlatformType value.
 * @param value - The PlatformType value to get the name for.
 * @returns The name of the PlatformType value, or undefined if not found.
 */
export function nameOfPlatformType(value: PlatformType): keyof typeof Platforms | undefined {
  return namesByPlatform.get(value);
}
