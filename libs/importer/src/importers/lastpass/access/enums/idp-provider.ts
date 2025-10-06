// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum IdpProvider {
  Azure = 0,
  OktaAuthServer = 1,
  OktaNoAuthServer = 2,
  Google = 3,
  PingOne = 4,
  OneLogin = 5,
}

/**
 * Represents the different identity providers supported for authentication.
 */
export const IdpProviders = Object.freeze({
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
export type IdpProviderType = (typeof IdpProviders)[keyof typeof IdpProviders];

const namesByIdpProvider = new Map<IdpProviderType, keyof typeof IdpProviders>(
  Object.entries(IdpProviders).map(([key, value]) => [value, key as keyof typeof IdpProviders]),
);

/**
 * Checks if a value is a valid IdpProviderType.
 * @param value - The value to check.
 * @returns True if the value is a valid IdpProviderType, false otherwise.
 */
export function isIdpProviderType(value: unknown): value is IdpProviderType {
  return namesByIdpProvider.has(value as IdpProviderType);
}

/**
 * Converts a value to a IdpProviderType if it is valid.
 * @param value - The value to convert.
 * @returns The value as a IdpProviderType if valid, otherwise undefined.
 */
export function asIdpProviderType(value: unknown): IdpProviderType | undefined {
  return isIdpProviderType(value) ? (value as IdpProviderType) : undefined;
}

/**
 * Gets the name of a IdpProviderType value.
 * @param value - The IdpProviderType value to get the name for.
 * @returns The name of the IdpProviderType value, or undefined if not found.
 */
export function nameOfIdpProviderType(
  value: IdpProviderType,
): keyof typeof IdpProviders | undefined {
  return namesByIdpProvider.get(value);
}
