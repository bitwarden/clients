// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AuthenticationType {
  Password = 0,
  Sso = 1,
  UserApiKey = 2,
  AuthRequest = 3,
  WebAuthn = 4,
}
