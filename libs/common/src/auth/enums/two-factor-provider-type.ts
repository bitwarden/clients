export const TwoFactorProviderType = Object.freeze({
  Authenticator: 0,
  Email: 1,
  Duo: 2,
  Yubikey: 3,
  U2f: 4,
  Remember: 5,
  OrganizationDuo: 6,
  WebAuthn: 7,
  RecoveryCode: 8,
} as const);
export type TwoFactorProviderType =
  (typeof TwoFactorProviderType)[keyof typeof TwoFactorProviderType];
