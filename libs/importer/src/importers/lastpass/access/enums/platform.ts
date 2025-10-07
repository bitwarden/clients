/**
 * Platform types representing different device categories.
 */
export const Platform = Object.freeze({
  Desktop: 0,
  Mobile: 1,
} as const);

/**
 * Type representing valid platform values.
 */
export type Platform = (typeof Platform)[keyof typeof Platform];

const namesByPlatform = new Map<Platform, keyof typeof Platform>(
  Object.entries(Platform).map(([key, value]) => [value, key as keyof typeof Platform]),
);

/**
 * Checks if a value is a valid Platform.
 * @param value - The value to check.
 * @returns True if the value is a valid Platform, false otherwise.
 */
export function isPlatform(value: unknown): value is Platform {
  return namesByPlatform.has(value as Platform);
}

/**
 * Converts a value to a Platform if it is valid.
 * @param value - The value to convert.
 * @returns The value as a Platform if valid, otherwise undefined.
 */
export function asPlatform(value: unknown): Platform | undefined {
  return isPlatform(value) ? (value as Platform) : undefined;
}

/**
 * Gets the name of a Platform value.
 * @param value - The Platform value to get the name for.
 * @returns The name of the Platform value, or undefined if not found.
 */
export function nameOfPlatform(value: Platform): keyof typeof Platform | undefined {
  return namesByPlatform.get(value);
}
