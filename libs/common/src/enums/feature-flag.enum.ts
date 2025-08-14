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

  /* Auth */
  PM14938_BrowserExtensionLoginApproval = "pm-14938-browser-extension-login-approvals",

  /* Autofill */
  BlockBrowserInjectionsByDomain = "block-browser-injections-by-domain",
  EnableNewCardCombinedExpiryAutofill = "enable-new-card-combined-expiry-autofill",
  NotificationRefresh = "notification-refresh",
  UseTreeWalkerApiForPageDetailsCollection = "use-tree-walker-api-for-page-details-collection",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  WindowsDesktopAutotype = "windows-desktop-autotype",

  /* Billing */
  TrialPaymentOptional = "PM-8163-trial-payment",
  PM12276_BreadcrumbEventLogs = "pm-12276-breadcrumbing-for-business-features",
  PM17772_AdminInitiatedSponsorships = "pm-17772-admin-initiated-sponsorships",
  UseOrganizationWarningsService = "use-organization-warnings-service",
  AllowTrialLengthZero = "pm-20322-allow-trial-length-0",
  PM21881_ManagePaymentDetailsOutsideCheckout = "pm-21881-manage-payment-details-outside-checkout",
  PM21821_ProviderPortalTakeover = "pm-21821-provider-portal-takeover",

  /* Key Management */
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  EnrollAeadOnKeyRotation = "enroll-aead-on-key-rotation",
  ForceUpdateKDFSettings = "pm-18021-force-update-kdf-settings",

  /* Tools */
  DesktopSendUIRefresh = "desktop-send-ui-refresh",
  UseSdkPasswordGenerators = "pm-19976-use-sdk-password-generators",

  /* DIRT */
  EventBasedOrganizationIntegrations = "event-based-organization-integrations",

  /* Vault */
  PM8851_BrowserOnboardingNudge = "pm-8851-browser-onboarding-nudge",
  PM19941MigrateCipherDomainToSdk = "pm-19941-migrate-cipher-domain-to-sdk",
  PM22134SdkCipherListView = "pm-22134-sdk-cipher-list-view",
  PM22136_SdkCipherEncryption = "pm-22136-sdk-cipher-encryption",
  CipherKeyEncryption = "cipher-key-encryption",
  RemoveCardItemTypePolicy = "pm-16442-remove-card-item-type-policy",
  PM19315EndUserActivationMvp = "pm-19315-end-user-activation-mvp",

  /* Platform */
  IpcChannelFramework = "ipc-channel-framework",
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

  /* Autofill */
  [FeatureFlag.BlockBrowserInjectionsByDomain]: FALSE,
  [FeatureFlag.EnableNewCardCombinedExpiryAutofill]: FALSE,
  [FeatureFlag.NotificationRefresh]: FALSE,
  [FeatureFlag.UseTreeWalkerApiForPageDetailsCollection]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.WindowsDesktopAutotype]: FALSE,

  /* Tools */
  [FeatureFlag.DesktopSendUIRefresh]: FALSE,
  [FeatureFlag.UseSdkPasswordGenerators]: FALSE,

  /* DIRT */
  [FeatureFlag.EventBasedOrganizationIntegrations]: FALSE,

  /* Vault */
  [FeatureFlag.PM8851_BrowserOnboardingNudge]: FALSE,
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM19941MigrateCipherDomainToSdk]: FALSE,
  [FeatureFlag.RemoveCardItemTypePolicy]: FALSE,
  [FeatureFlag.PM22134SdkCipherListView]: FALSE,
  [FeatureFlag.PM19315EndUserActivationMvp]: FALSE,
  [FeatureFlag.PM22136_SdkCipherEncryption]: FALSE,

  /* Auth */
  [FeatureFlag.PM14938_BrowserExtensionLoginApproval]: FALSE,

  /* Billing */
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.PM12276_BreadcrumbEventLogs]: FALSE,
  [FeatureFlag.PM17772_AdminInitiatedSponsorships]: FALSE,
  [FeatureFlag.UseOrganizationWarningsService]: FALSE,
  [FeatureFlag.AllowTrialLengthZero]: FALSE,
  [FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout]: FALSE,
  [FeatureFlag.PM21821_ProviderPortalTakeover]: FALSE,

  /* Key Management */
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.EnrollAeadOnKeyRotation]: FALSE,
  [FeatureFlag.ForceUpdateKDFSettings]: FALSE,

  /* Platform */
  [FeatureFlag.IpcChannelFramework]: FALSE,
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
