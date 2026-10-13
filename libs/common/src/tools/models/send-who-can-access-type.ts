export const WhoCanAccessType = Object.freeze({
  /** Allow any auth type on Sends */
  Any: 0,
  /** Require password protection on Sends */
  PasswordProtected: 1,
  /** Require email verification on Sends */
  SpecificPeople: 2,
} as const);
export type WhoCanAccessType = (typeof WhoCanAccessType)[keyof typeof WhoCanAccessType];
