/**
 * Represents OTP authentication methods.
 */
export const OtpMethod = Object.freeze({
  GoogleAuth: 0,
  MicrosoftAuth: 1,
  Yubikey: 2,
} as const);

/**
 * Type representing valid OTP method values.
 */
export type OtpMethod = (typeof OtpMethod)[keyof typeof OtpMethod];

const namesByOtpMethod = new Map<OtpMethod, keyof typeof OtpMethod>(
  Object.entries(OtpMethod).map(([key, value]) => [value, key as keyof typeof OtpMethod]),
);

/**
 * Checks if a value is a valid OtpMethod.
 * @param value - The value to check.
 * @returns True if the value is a valid OtpMethod, false otherwise.
 */
export function isOtpMethod(value: unknown): value is OtpMethod {
  return namesByOtpMethod.has(value as OtpMethod);
}

/**
 * Converts a value to a OtpMethod if it is valid.
 * @param value - The value to convert.
 * @returns The value as a OtpMethod if valid, otherwise undefined.
 */
export function asOtpMethod(value: unknown): OtpMethod | undefined {
  return isOtpMethod(value) ? (value as OtpMethod) : undefined;
}

/**
 * Gets the name of a OtpMethod value.
 * @param value - The OtpMethod value to get the name for.
 * @returns The name of the OtpMethod value, or undefined if not found.
 */
export function nameOfOtpMethod(value: OtpMethod): keyof typeof OtpMethod | undefined {
  return namesByOtpMethod.get(value);
}
