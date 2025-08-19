// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum OrganizationUserType {
  Owner = 0,
  Admin = 1,
  User = 2,
  // Manager = 3 has been intentionally permanently deleted
  Custom = 4,
}
