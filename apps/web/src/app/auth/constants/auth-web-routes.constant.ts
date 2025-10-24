// Web route segments auth owns under shared infrastructure
export const AuthWebRouteSegments = Object.freeze({
  // settings routes
  Account: "account",
  EmergencyAccess: "emergency-access",

  // settings/security routes
  Password: "password",
  TwoFactor: "two-factor",
  SecurityKeys: "security-keys",
  DeviceManagement: "device-management",
} as const);

export type AuthWebRouteSegment = (typeof AuthWebRouteSegments)[keyof typeof AuthWebRouteSegments];

// Full routes that auth owns in the web app
export const AuthWebRoutes = Object.freeze({
  SignUpLinkExpired: "signup-link-expired",
  RecoverTwoFactor: "recover-2fa",
  AcceptEmergencyAccessInvite: "accept-emergency",
  RecoverDeleteAccount: "recover-delete",
  VerifyRecoverDeleteAccount: "verify-recover-delete",
  AcceptOrganizationInvite: "accept-organization",

  // Composed routes from segments (allowing for router.navigate / routerLink usage)
  AccountSettings: `settings/${AuthWebRouteSegments.Account}`,
  EmergencyAccessSettings: `settings/${AuthWebRouteSegments.EmergencyAccess}`,

  PasswordSettings: `settings/security/${AuthWebRouteSegments.Password}`,
  TwoFactorSettings: `settings/security/${AuthWebRouteSegments.TwoFactor}`,
  SecurityKeysSettings: `settings/security/${AuthWebRouteSegments.SecurityKeys}`,
  DeviceManagement: `settings/security/${AuthWebRouteSegments.DeviceManagement}`,
} as const);

export type AuthWebRoute = (typeof AuthWebRoutes)[keyof typeof AuthWebRoutes];
