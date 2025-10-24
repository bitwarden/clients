// Full routes that auth owns in the extension
export const AuthExtensionRoutes = Object.freeze({
  AccountSecurity: "account-security",
  DeviceManagement: "device-management",
  AccountSwitcher: "account-switcher",
} as const);

export type AuthExtensionRoute = (typeof AuthExtensionRoutes)[keyof typeof AuthExtensionRoutes];
