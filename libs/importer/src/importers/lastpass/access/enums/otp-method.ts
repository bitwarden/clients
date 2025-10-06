// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum OtpMethod {
  GoogleAuth,
  MicrosoftAuth,
  Yubikey,
}

/**
 * Represents OTP authentication methods.
 */
export const OtpMethods = Object.freeze({
  GoogleAuth: 0,
  MicrosoftAuth: 1,
  Yubikey: 2,
} as const);

/**
 * Type representing valid OTP method values.
 */
export type OtpMethodType = (typeof OtpMethods)[keyof typeof OtpMethods];

const namesByOtpMethod = new Map<OtpMethodType, keyof typeof OtpMethods>(
  Object.entries(OtpMethods).map(([key, value]) => [value, key as keyof typeof OtpMethods]),
);

/**
 * Checks if a value is a valid OtpMethodType.
 * @param value - The value to check.
 * @returns True if the value is a valid OtpMethodType, false otherwise.
 */
export function isOtpMethodType(value: unknown): value is OtpMethodType {
  return namesByOtpMethod.has(value as OtpMethodType);
}

/**
 * Converts a value to a OtpMethodType if it is valid.
 * @param value - The value to convert.
 * @returns The value as a OtpMethodType if valid, otherwise undefined.
 */
export function asOtpMethodType(value: unknown): OtpMethodType | undefined {
  return isOtpMethodType(value) ? (value as OtpMethodType) : undefined;
}

/**
 * Gets the name of a OtpMethodType value.
 * @param value - The OtpMethodType value to get the name for.
 * @returns The name of the OtpMethodType value, or undefined if not found.
 */
export function nameOfOtpMethodType(value: OtpMethodType): keyof typeof OtpMethods | undefined {
  return namesByOtpMethod.get(value);
}
