export const TwoFactorProviderType = Object.freeze({
  Authenticator: 0,
  Email: 1,
  Duo: 2,
  Yubikey: 3,
  // U2f: 4, - deprecated in favor of WebAuthn
  Remember: 5,
  OrganizationDuo: 6,
  WebAuthn: 7,
  RecoveryCode: 8,
} as const);
export type TwoFactorProviderType =
  (typeof TwoFactorProviderType)[keyof typeof TwoFactorProviderType];

/**
 * Type guard that checks whether an unknown value is a valid {@link TwoFactorProviderType}.
 *
 * Useful for validating untrusted input (e.g. parsed integers from CLI arguments or API
 * responses) before assigning it to a typed variable.
 *
 * @param value - The value to test.
 * @returns `true` if `value` is one of the known {@link TwoFactorProviderType} values, narrowing
 * the type accordingly.
 *
 * @example
 * const parsed = parseInt(raw, 10);
 * if (isTwoFactorProviderType(parsed)) {
 *   // parsed is TwoFactorProviderType here
 * }
 */
export function isTwoFactorProviderType(value: unknown): value is TwoFactorProviderType {
  return (Object.values(TwoFactorProviderType) as number[]).includes(value as number);
}
