// Web route segments auth owns under shared infrastructure
export const AuthWebRouteSegment = Object.freeze({
  // settings routes
  Account: "account",
  EmergencyAccess: "emergency-access",

  // settings/security routes
  Password: "password",
  TwoFactor: "two-factor",
  SecurityKeys: "security-keys",
  DeviceManagement: "device-management",
} as const);

export type AuthWebRouteSegment = (typeof AuthWebRouteSegment)[keyof typeof AuthWebRouteSegment];

// Full routes that auth owns in the web app
export const AuthWebRoute = Object.freeze({
  SignUpLinkExpired: "signup-link-expired",
  RecoverTwoFactor: "recover-2fa",
  AcceptEmergencyAccessInvite: "accept-emergency",
  RecoverDeleteAccount: "recover-delete",
  VerifyRecoverDeleteAccount: "verify-recover-delete",
  AcceptOrganizationInvite: "accept-organization",

  // Composed routes from segments (allowing for router.navigate / routerLink usage)
  AccountSettings: `settings/${AuthWebRouteSegment.Account}`,
  EmergencyAccessSettings: `settings/${AuthWebRouteSegment.EmergencyAccess}`,

  PasswordSettings: `settings/security/${AuthWebRouteSegment.Password}`,
  TwoFactorSettings: `settings/security/${AuthWebRouteSegment.TwoFactor}`,
  SecurityKeysSettings: `settings/security/${AuthWebRouteSegment.SecurityKeys}`,
  DeviceManagement: `settings/security/${AuthWebRouteSegment.DeviceManagement}`,
} as const);

export type AuthWebRoute = (typeof AuthWebRoute)[keyof typeof AuthWebRoute];
