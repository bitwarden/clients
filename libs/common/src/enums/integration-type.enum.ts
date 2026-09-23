export const IntegrationType = Object.freeze({
  Integration: "integration",
  SDK: "sdk",
  SSO: "sso",
  SCIM: "scim",
  BWDC: "bwdc",
  EVENT: "event",
  DEVICE: "device",
} as const);

export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType];
