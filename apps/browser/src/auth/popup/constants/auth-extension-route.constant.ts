// Full routes that auth owns in the extension
export const AuthExtensionRoute = Object.freeze({
  AccountSecurity: "account-security",
  /**
   * `AuthExtensionRoute.SettingsPassword` uses `ChangePasswordPageComponent` and is used when the user intentionally navigates
   * to Settings > Account Security to change their password.
   *
   * This is distinct from `AuthRoute.ChangePassword`, which uses `ExtensionAnonLayoutWrapperComponent`, and is used when
   * `ForceSetPasswordReason` forces the user to change their password due to either `AdminForcePasswordReset` or `WeakMasterPassword`
   *
   * IMPORTANT: This `AuthExtensionRoute.SettingsPassword` route path must NOT contain the substring "change-password". The `authGuard`
   * uses a substring check (`url.includes("change-password")`) to exempt the forced `/change-password` route from redirection — a route
   * containing that substring would be incorrectly exempted. This mirrors the existing pattern on Web, where the equivalent route is
   * `/settings/security/password`, not `/settings/security/change-password`. See PM-34258 for further explanation/future cleanup.
   *
   * TODO: PM-34240 - move auth settings to a nested routing structure, e.g. `/settings/account-security/change-password`,
   * and update the `authGuard` substring check accordingly (though it might already have been updated by PM-34258)
   */
  SettingsPassword: "settings-password",
  DeviceManagement: "device-management",
  AccountSwitcher: "account-switcher",
} as const);

export type AuthExtensionRoute = (typeof AuthExtensionRoute)[keyof typeof AuthExtensionRoute];
