// Note: the enum key is used to describe the EventSystemUser in the UI. Be careful about changing it.
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum EventSystemUser {
  SCIM = 1,
  DomainVerification = 2,
  PublicApi = 3,
}
