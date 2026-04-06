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
