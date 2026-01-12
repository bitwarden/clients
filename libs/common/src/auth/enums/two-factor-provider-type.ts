// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum TwoFactorProviderType {
  Authenticator = 0,
  Email = 1,
  Duo = 2,
  Yubikey = 3,
  U2f = 4,
  Remember = 5,
  OrganizationDuo = 6,
  WebAuthn = 7,
  RecoveryCode = 8,
}
