// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ProviderUserStatusType {
  Invited = 0,
  Accepted = 1,
  Confirmed = 2,
  Revoked = -1, // Not used, compile-time support only
}
