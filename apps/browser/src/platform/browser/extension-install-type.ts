export const ExtensionInstallType = Object.freeze({
  Admin: "admin",
  Development: "development",
  Normal: "normal",
  Sideload: "sideload",
  Other: "other",
  Unknown: "unknown",
} as const);

export type ExtensionInstallType = (typeof ExtensionInstallType)[keyof typeof ExtensionInstallType];
