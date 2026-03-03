import { ServerConfig } from "../platform/abstractions/config/server-config";

/**
 * Feature flags.
 *
 * Flags MUST be short lived and SHALL be removed once enabled.
 *
 * Flags should be grouped by team to have visibility of ownership and cleanup.
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum FeatureFlag {
  /* Admin Console Team */
  AutoConfirm = "pm-19934-auto-confirm-organization-users",
  DefaultUserCollectionRestore = "pm-30883-my-items-restored-users",
  BulkReinviteUI = "pm-28416-bulk-reinvite-ux-improvements",

  /* Auth */
  PM23801_PrefetchPasswordPrelogin = "pm-23801-prefetch-password-prelogin",
  PM27086_UpdateAuthenticationApisForInputPassword = "pm-27086-update-authentication-apis-for-input-password",
  SafariAccountSwitching = "pm-5594-safari-account-switching",
  PM30811_ChangeEmailNewAuthenticationApis = "pm-30811-change-email-new-authentication-apis",
  PM31088_MasterPasswordServiceEmitSalt = "pm-31088-master-password-service-emit-salt",

  /* Autofill */
  UseUndeterminedCipherScenarioTriggeringLogic = "undetermined-cipher-scenario-logic",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  WindowsDesktopAutotype = "windows-desktop-autotype",
  WindowsDesktopAutotypeGA = "windows-desktop-autotype-ga",
  SSHAgentV2 = "ssh-agent-v2",

  /* Billing */
  TrialPaymentOptional = "PM-8163-trial-payment",
  PM24032_NewNavigationPremiumUpgradeButton = "pm-24032-new-navigation-premium-upgrade-button",
  PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog = "pm-23713-premium-badge-opens-new-premium-upgrade-dialog",
  PM26462_Milestone_3 = "pm-26462-milestone-3",
  PM23341_Milestone_2 = "pm-23341-milestone-2",
  PM29594_UpdateIndividualSubscriptionPage = "pm-29594-update-individual-subscription-page",
  PM29593_PremiumToOrganizationUpgrade = "pm-29593-premium-to-organization-upgrade",

  /* Key Management */
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  EnrollAeadOnKeyRotation = "enroll-aead-on-key-rotation",
  ForceUpdateKDFSettings = "pm-18021-force-update-kdf-settings",
  SdkKeyRotation = "pm-30144-sdk-key-rotation",
  LinuxBiometricsV2 = "pm-26340-linux-biometrics-v2",
  NoLogoutOnKdfChange = "pm-23995-no-logout-on-kdf-change",
  PasskeyUnlock = "pm-2035-passkey-unlock",
  DataRecoveryTool = "pm-28813-data-recovery-tool",
  ConsolidatedSessionTimeoutComponent = "pm-26056-consolidated-session-timeout-component",
  PM27279_V2RegistrationTdeJit = "pm-27279-v2-registration-tde-jit",
  EnableAccountEncryptionV2KeyConnectorRegistration = "enable-account-encryption-v2-key-connector-registration",
  EnableAccountEncryptionV2JitPasswordRegistration = "enable-account-encryption-v2-jit-password-registration",

  /* Tools */
  UseSdkPasswordGenerators = "pm-19976-use-sdk-password-generators",
  SendUIRefresh = "pm-28175-send-ui-refresh",
  SendEmailOTP = "pm-19051-send-email-verification",

  /* DIRT */
  EventManagementForDataDogAndCrowdStrike = "event-management-for-datadog-and-crowdstrike",
  EventManagementForHuntress = "event-management-for-huntress",
  PhishingDetection = "phishing-detection",
  Milestone11AppPageImprovements = "pm-30538-dirt-milestone-11-app-page-improvements",

  /* Vault */
  PM19941MigrateCipherDomainToSdk = "pm-19941-migrate-cipher-domain-to-sdk",
  PM22134SdkCipherListView = "pm-22134-sdk-cipher-list-view",
  PM22136_SdkCipherEncryption = "pm-22136-sdk-cipher-encryption",
  CipherKeyEncryption = "cipher-key-encryption",
  BrowserPremiumSpotlight = "pm-23384-browser-premium-spotlight",
  MigrateMyVaultToMyItems = "pm-20558-migrate-myvault-to-myitems",
  PM27632_SdkCipherCrudOperations = "pm-27632-cipher-crud-operations-to-sdk",
  PM30521_AutofillButtonViewLoginScreen = "pm-30521-autofill-button-view-login-screen",
  PM29438_WelcomeDialogWithExtensionPrompt = "pm-29438-welcome-dialog-with-extension-prompt",
  PM29438_DialogWithExtensionPromptAccountAge = "pm-29438-dialog-with-extension-prompt-account-age",
  PM29437_WelcomeDialog = "pm-29437-welcome-dialog-no-ext-prompt",
  PM31039ItemActionInExtension = "pm-31039-item-action-in-extension",

  /* Platform */
  ContentScriptIpcChannelFramework = "content-script-ipc-channel-framework",
  WebAuthnRelatedOrigins = "pm-30529-webauthn-related-origins",

  /* Innovation */
  PM19148_InnovationArchive = "pm-19148-innovation-archive",

  /* Desktop */
  DesktopUiMigrationMilestone1 = "desktop-ui-migration-milestone-1",
  DesktopUiMigrationMilestone2 = "desktop-ui-migration-milestone-2",
  DesktopUiMigrationMilestone3 = "desktop-ui-migration-milestone-3",
  DesktopUiMigrationMilestone4 = "desktop-ui-migration-milestone-4",

  /* UIF */
  RouterFocusManagement = "router-focus-management",
}

export type AllowedFeatureFlagTypes = boolean | number | string;

// Helper to ensure the value is treated as a boolean.
const FALSE = false as boolean;

/**
 * Default value for feature flags.
 *
 * DO NOT enable previously disabled flags, REMOVE them instead.
 * We support true as a value as we prefer flags to "enable" not "disable".
 *
 * Flags should be grouped by team to have visibility of ownership and cleanup.
 */
export const DefaultFeatureFlagValue = {
  /* Admin Console Team */
  [FeatureFlag.AutoConfirm]: FALSE,
  [FeatureFlag.DefaultUserCollectionRestore]: FALSE,
  [FeatureFlag.BulkReinviteUI]: FALSE,

  /* Autofill */
  [FeatureFlag.UseUndeterminedCipherScenarioTriggeringLogic]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.WindowsDesktopAutotype]: FALSE,
  [FeatureFlag.WindowsDesktopAutotypeGA]: FALSE,
  [FeatureFlag.SSHAgentV2]: FALSE,
  [FeatureFlag.PM31039ItemActionInExtension]: FALSE,

  /* Tools */
  [FeatureFlag.UseSdkPasswordGenerators]: FALSE,
  [FeatureFlag.SendUIRefresh]: FALSE,
  [FeatureFlag.SendEmailOTP]: FALSE,

  /* DIRT */
  [FeatureFlag.EventManagementForDataDogAndCrowdStrike]: FALSE,
  [FeatureFlag.EventManagementForHuntress]: FALSE,
  [FeatureFlag.PhishingDetection]: FALSE,
  [FeatureFlag.Milestone11AppPageImprovements]: FALSE,

  /* Vault */
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM19941MigrateCipherDomainToSdk]: FALSE,
  [FeatureFlag.PM22134SdkCipherListView]: FALSE,
  [FeatureFlag.PM22136_SdkCipherEncryption]: FALSE,
  [FeatureFlag.BrowserPremiumSpotlight]: FALSE,
  [FeatureFlag.PM27632_SdkCipherCrudOperations]: FALSE,
  [FeatureFlag.MigrateMyVaultToMyItems]: FALSE,
  [FeatureFlag.PM30521_AutofillButtonViewLoginScreen]: FALSE,
  [FeatureFlag.PM29438_WelcomeDialogWithExtensionPrompt]: FALSE,
  [FeatureFlag.PM29438_DialogWithExtensionPromptAccountAge]: 5,
  [FeatureFlag.PM29437_WelcomeDialog]: FALSE,

  /* Auth */
  [FeatureFlag.PM23801_PrefetchPasswordPrelogin]: FALSE,
  [FeatureFlag.PM27086_UpdateAuthenticationApisForInputPassword]: FALSE,
  [FeatureFlag.SafariAccountSwitching]: FALSE,
  [FeatureFlag.PM30811_ChangeEmailNewAuthenticationApis]: FALSE,
  [FeatureFlag.PM31088_MasterPasswordServiceEmitSalt]: FALSE,

  /* Billing */
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.PM24032_NewNavigationPremiumUpgradeButton]: FALSE,
  [FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog]: FALSE,
  [FeatureFlag.PM26462_Milestone_3]: FALSE,
  [FeatureFlag.PM23341_Milestone_2]: FALSE,
  [FeatureFlag.PM29594_UpdateIndividualSubscriptionPage]: FALSE,
  [FeatureFlag.PM29593_PremiumToOrganizationUpgrade]: FALSE,

  /* Key Management */
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.EnrollAeadOnKeyRotation]: FALSE,
  [FeatureFlag.ForceUpdateKDFSettings]: FALSE,
  [FeatureFlag.SdkKeyRotation]: FALSE,
  [FeatureFlag.LinuxBiometricsV2]: FALSE,
  [FeatureFlag.NoLogoutOnKdfChange]: FALSE,
  [FeatureFlag.PasskeyUnlock]: FALSE,
  [FeatureFlag.DataRecoveryTool]: FALSE,
  [FeatureFlag.ConsolidatedSessionTimeoutComponent]: FALSE,
  [FeatureFlag.PM27279_V2RegistrationTdeJit]: FALSE,
  [FeatureFlag.EnableAccountEncryptionV2KeyConnectorRegistration]: FALSE,
  [FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration]: FALSE,

  /* Platform */
  [FeatureFlag.ContentScriptIpcChannelFramework]: FALSE,
  [FeatureFlag.WebAuthnRelatedOrigins]: FALSE,

  /* Innovation */
  [FeatureFlag.PM19148_InnovationArchive]: FALSE,

  /* Desktop */
  [FeatureFlag.DesktopUiMigrationMilestone1]: FALSE,
  [FeatureFlag.DesktopUiMigrationMilestone2]: FALSE,
  [FeatureFlag.DesktopUiMigrationMilestone3]: FALSE,
  [FeatureFlag.DesktopUiMigrationMilestone4]: FALSE,

  /* UIF */
  [FeatureFlag.RouterFocusManagement]: FALSE,
} satisfies Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type DefaultFeatureFlagValueType = typeof DefaultFeatureFlagValue;

export type FeatureFlagValueType<Flag extends FeatureFlag> = DefaultFeatureFlagValueType[Flag];

export function getFeatureFlagValue<Flag extends FeatureFlag>(
  serverConfig: ServerConfig | null,
  flag: Flag,
) {
  if (serverConfig?.featureStates == null || serverConfig.featureStates[flag] == null) {
    return DefaultFeatureFlagValue[flag];
  }

  return serverConfig.featureStates[flag] as FeatureFlagValueType<Flag>;
}
