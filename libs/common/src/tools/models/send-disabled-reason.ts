export const SendDisabledReason = Object.freeze({
  /** Send is not disabled */
  None: 0,
  /** Send is disabled for a non-specific reason */
  Other: 1,
  /** Send is disabled because it is of a type disallowed by policy */
  RestrictedType: 2,
} as const);
export type SendDisabledReason = (typeof SendDisabledReason)[keyof typeof SendDisabledReason];
