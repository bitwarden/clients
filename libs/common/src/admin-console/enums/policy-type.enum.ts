// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum PolicyType {
  TwoFactorAuthentication = 0, // Requires users to have 2fa enabled
  MasterPassword = 1, // Sets minimum requirements for master password complexity
  PasswordGenerator = 2, // Sets minimum requirements/default type for generated passwords/passphrases
  SingleOrg = 3, // Allows users to only be apart of one organization
  RequireSso = 4, // Requires users to authenticate with SSO
  OrganizationDataOwnership = 5, // Enforces organization ownership items added/cloned to the default collection
  DisableSend = 6, // Disables the ability to create and edit Bitwarden Sends
  SendOptions = 7, // Sets restrictions or defaults for Bitwarden Sends
  ResetPassword = 8, // Allows orgs to use reset password : also can enable auto-enrollment during invite flow
  MaximumVaultTimeout = 9, // Sets the maximum allowed vault timeout
  DisablePersonalVaultExport = 10, // Disable personal vault export
  ActivateAutofill = 11, // Activates autofill with page load on the browser extension
  AutomaticAppLogIn = 12, // Enables automatic log in of apps from configured identity provider
  FreeFamiliesSponsorshipPolicy = 13, // Disables free families plan for organization
  RemoveUnlockWithPin = 14, // Do not allow members to unlock their account with a PIN.
  RestrictedItemTypes = 15, // Restricts item types that can be created within an organization
  UriMatchDefaults = 16, // Sets the default URI matching strategy for all users within an organization
  AutotypeDefaultSetting = 17, // Sets the default autotype setting for desktop app
}
