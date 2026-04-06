/**
 * Represents the different identity providers supported for authentication.
 */
export const IdpProvider = Object.freeze({
  Azure: 0,
  OktaAuthServer: 1,
  OktaNoAuthServer: 2,
  Google: 3,
  PingOne: 4,
  OneLogin: 5,
} as const);

/**
 * Type representing valid identity provider values.
 */
export type IdpProvider = (typeof IdpProvider)[keyof typeof IdpProvider];
