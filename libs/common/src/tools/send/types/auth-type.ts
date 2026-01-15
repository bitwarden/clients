/** An type of auth necessary to access a Send */
export const AuthType = Object.freeze({
  /** Send requires email OTP verification */
  Email: 0,
  /** Send requires a password */
  Password: 1,
  /** Send requires no auth */
  None: 2,
} as const);

/** An type of auth necessary to access a Send */
export type AuthType = (typeof AuthType)[keyof typeof AuthType];
