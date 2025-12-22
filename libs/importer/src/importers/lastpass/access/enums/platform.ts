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
