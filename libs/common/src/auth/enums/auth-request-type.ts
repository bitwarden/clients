// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AuthRequestType {
  AuthenticateAndUnlock = 0,
  Unlock = 1,
  AdminApproval = 2,
}
