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
