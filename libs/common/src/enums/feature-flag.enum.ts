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
  CreateDefaultLocation = "pm-19467-create-default-location",
  AutoConfirm = "pm-19934-auto-confirm-organization-users",

  /* Auth */
  PM22110_DisableAlternateLoginMethods = "pm-22110-disable-alternate-login-methods",

  /* Autofill */
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  WindowsDesktopAutotype = "windows-desktop-autotype",

  /* Billing */
  TrialPaymentOptional = "PM-8163-trial-payment",
  PM21821_ProviderPortalTakeover = "pm-21821-provider-portal-takeover",
  PM22415_TaxIDWarnings = "pm-22415-tax-id-warnings",
  PM24032_NewNavigationPremiumUpgradeButton = "pm-24032-new-navigation-premium-upgrade-button",
  PM25379_UseNewOrganizationMetadataStructure = "pm-25379-use-new-organization-metadata-structure",
  PM24996_ImplementUpgradeFromFreeDialog = "pm-24996-implement-upgrade-from-free-dialog",
  PM24033PremiumUpgradeNewDesign = "pm-24033-updat-premium-subscription-page",
  PM26793_FetchPremiumPriceFromPricingService = "pm-26793-fetch-premium-price-from-pricing-service",
  PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog = "pm-23713-premium-badge-opens-new-premium-upgrade-dialog",

  /* Key Management */
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  EnrollAeadOnKeyRotation = "enroll-aead-on-key-rotation",
  ForceUpdateKDFSettings = "pm-18021-force-update-kdf-settings",
  PM25174_DisableType0Decryption = "pm-25174-disable-type-0-decryption",
  WindowsBiometricsV2 = "pm-25373-windows-biometrics-v2",
  LinuxBiometricsV2 = "pm-26340-linux-biometrics-v2",
  UnlockWithMasterPasswordUnlockData = "pm-23246-unlock-with-master-password-unlock-data",
  NoLogoutOnKdfChange = "pm-23995-no-logout-on-kdf-change",

  /* Tools */
  DesktopSendUIRefresh = "desktop-send-ui-refresh",
  UseSdkPasswordGenerators = "pm-19976-use-sdk-password-generators",
  ChromiumImporterWithABE = "pm-25855-chromium-importer-abe",

  /* DIRT */
  EventManagementForDataDogAndCrowdStrike = "event-management-for-datadog-and-crowdstrike",
  PhishingDetection = "phishing-detection",
  PM22887_RiskInsightsActivityTab = "pm-22887-risk-insights-activity-tab",

  /* Vault */
  PM19941MigrateCipherDomainToSdk = "pm-19941-migrate-cipher-domain-to-sdk",
  PM22134SdkCipherListView = "pm-22134-sdk-cipher-list-view",
  PM22136_SdkCipherEncryption = "pm-22136-sdk-cipher-encryption",
  CipherKeyEncryption = "cipher-key-encryption",
  AutofillConfirmation = "pm-25083-autofill-confirm-from-search",

  /* Platform */
  IpcChannelFramework = "ipc-channel-framework",
  InactiveUserServerNotification = "pm-25130-receive-push-notifications-for-inactive-users",
  PushNotificationsWhenLocked = "pm-19388-push-notifications-when-locked",

  /* Innovation */
  PM19148_InnovationArchive = "pm-19148-innovation-archive",
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
  [FeatureFlag.CreateDefaultLocation]: FALSE,
  [FeatureFlag.AutoConfirm]: FALSE,

  /* Autofill */
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.WindowsDesktopAutotype]: FALSE,

  /* Tools */
  [FeatureFlag.DesktopSendUIRefresh]: FALSE,
  [FeatureFlag.UseSdkPasswordGenerators]: FALSE,
  [FeatureFlag.ChromiumImporterWithABE]: FALSE,

  /* DIRT */
  [FeatureFlag.EventManagementForDataDogAndCrowdStrike]: FALSE,
  [FeatureFlag.PhishingDetection]: FALSE,
  [FeatureFlag.PM22887_RiskInsightsActivityTab]: FALSE,

  /* Vault */
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM19941MigrateCipherDomainToSdk]: FALSE,
  [FeatureFlag.PM22134SdkCipherListView]: FALSE,
  [FeatureFlag.PM22136_SdkCipherEncryption]: FALSE,
  [FeatureFlag.AutofillConfirmation]: FALSE,

  /* Auth */
  [FeatureFlag.PM22110_DisableAlternateLoginMethods]: FALSE,

  /* Billing */
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.PM21821_ProviderPortalTakeover]: FALSE,
  [FeatureFlag.PM22415_TaxIDWarnings]: FALSE,
  [FeatureFlag.PM24032_NewNavigationPremiumUpgradeButton]: FALSE,
  [FeatureFlag.PM25379_UseNewOrganizationMetadataStructure]: FALSE,
  [FeatureFlag.PM24996_ImplementUpgradeFromFreeDialog]: FALSE,
  [FeatureFlag.PM24033PremiumUpgradeNewDesign]: FALSE,
  [FeatureFlag.PM26793_FetchPremiumPriceFromPricingService]: FALSE,
  [FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog]: FALSE,

  /* Key Management */
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.EnrollAeadOnKeyRotation]: FALSE,
  [FeatureFlag.ForceUpdateKDFSettings]: FALSE,
  [FeatureFlag.PM25174_DisableType0Decryption]: FALSE,
  [FeatureFlag.WindowsBiometricsV2]: FALSE,
  [FeatureFlag.LinuxBiometricsV2]: FALSE,
  [FeatureFlag.UnlockWithMasterPasswordUnlockData]: FALSE,
  [FeatureFlag.NoLogoutOnKdfChange]: FALSE,

  /* Platform */
  [FeatureFlag.IpcChannelFramework]: FALSE,
  [FeatureFlag.InactiveUserServerNotification]: FALSE,
  [FeatureFlag.PushNotificationsWhenLocked]: FALSE,

  /* Innovation */
  [FeatureFlag.PM19148_InnovationArchive]: FALSE,
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
