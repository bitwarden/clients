// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum IntegrationType {
  Integration = "integration",
  SDK = "sdk",
  SSO = "sso",
  SCIM = "scim",
  BWDC = "bwdc",
  EVENT = "event",
  DEVICE = "device",
}
