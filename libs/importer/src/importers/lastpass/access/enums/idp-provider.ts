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

const namesByIdpProvider = new Map<IdpProvider, keyof typeof IdpProvider>(
  Object.entries(IdpProvider).map(([key, value]) => [value, key as keyof typeof IdpProvider]),
);

/**
 * Checks if a value is a valid IdpProvider.
 * @param value - The value to check.
 * @returns True if the value is a valid IdpProvider, false otherwise.
 */
export function isIdpProvider(value: unknown): value is IdpProvider {
  return namesByIdpProvider.has(value as IdpProvider);
}

/**
 * Converts a value to a IdpProvider if it is valid.
 * @param value - The value to convert.
 * @returns The value as a IdpProvider if valid, otherwise undefined.
 */
export function asIdpProvider(value: unknown): IdpProvider | undefined {
  return isIdpProvider(value) ? (value as IdpProvider) : undefined;
}

/**
 * Gets the name of a IdpProvider value.
 * @param value - The IdpProvider value to get the name for.
 * @returns The name of the IdpProvider value, or undefined if not found.
 */
export function nameOfIdpProvider(value: IdpProvider): keyof typeof IdpProvider | undefined {
  return namesByIdpProvider.get(value);
}
