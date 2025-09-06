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
  CollectionVaultRefactor = "pm-25030-resolve-ts-upgrade-errors",

  /* Auth */
  PM14938_BrowserExtensionLoginApproval = "pm-14938-browser-extension-login-approvals",
  PM22110_DisableAlternateLoginMethods = "pm-22110-disable-alternate-login-methods",

  /* Autofill */
  NotificationRefresh = "notification-refresh",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  WindowsDesktopAutotype = "windows-desktop-autotype",

  /* Billing */
  TrialPaymentOptional = "PM-8163-trial-payment",
  PM17772_AdminInitiatedSponsorships = "pm-17772-admin-initiated-sponsorships",
  UseOrganizationWarningsService = "use-organization-warnings-service",
  PM21881_ManagePaymentDetailsOutsideCheckout = "pm-21881-manage-payment-details-outside-checkout",
  PM21821_ProviderPortalTakeover = "pm-21821-provider-portal-takeover",
  PM22415_TaxIDWarnings = "pm-22415-tax-id-warnings",

  /* Key Management */
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  EnrollAeadOnKeyRotation = "enroll-aead-on-key-rotation",
  ForceUpdateKDFSettings = "pm-18021-force-update-kdf-settings",

  /* Tools */
  DesktopSendUIRefresh = "desktop-send-ui-refresh",
  UseSdkPasswordGenerators = "pm-19976-use-sdk-password-generators",
  UseChromiumImporter = "pm-23982-chromium-importer",

  /* DIRT */
  EventBasedOrganizationIntegrations = "event-based-organization-integrations",

  /* Vault */
  PM19941MigrateCipherDomainToSdk = "pm-19941-migrate-cipher-domain-to-sdk",
  PM22134SdkCipherListView = "pm-22134-sdk-cipher-list-view",
  PM22136_SdkCipherEncryption = "pm-22136-sdk-cipher-encryption",
  CipherKeyEncryption = "cipher-key-encryption",
  RemoveCardItemTypePolicy = "pm-16442-remove-card-item-type-policy",

  /* Platform */
  IpcChannelFramework = "ipc-channel-framework",
  InactiveUserServerNotification = "pm-25130-receive-push-notifications-for-inactive-users",
  PushNotificationsWhenLocked = "pm-19388-push-notifications-when-locked",
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
  [FeatureFlag.CollectionVaultRefactor]: FALSE,

  /* Autofill */
  [FeatureFlag.NotificationRefresh]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.WindowsDesktopAutotype]: FALSE,

  /* Tools */
  [FeatureFlag.DesktopSendUIRefresh]: FALSE,
  [FeatureFlag.UseSdkPasswordGenerators]: FALSE,
  [FeatureFlag.UseChromiumImporter]: FALSE,

  /* DIRT */
  [FeatureFlag.EventBasedOrganizationIntegrations]: FALSE,

  /* Vault */
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM19941MigrateCipherDomainToSdk]: FALSE,
  [FeatureFlag.RemoveCardItemTypePolicy]: FALSE,
  [FeatureFlag.PM22134SdkCipherListView]: FALSE,
  [FeatureFlag.PM22136_SdkCipherEncryption]: FALSE,

  /* Auth */
  [FeatureFlag.PM14938_BrowserExtensionLoginApproval]: FALSE,
  [FeatureFlag.PM22110_DisableAlternateLoginMethods]: true,

  /* Billing */
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.PM17772_AdminInitiatedSponsorships]: FALSE,
  [FeatureFlag.UseOrganizationWarningsService]: FALSE,
  [FeatureFlag.PM21881_ManagePaymentDetailsOutsideCheckout]: FALSE,
  [FeatureFlag.PM21821_ProviderPortalTakeover]: FALSE,
  [FeatureFlag.PM22415_TaxIDWarnings]: FALSE,

  /* Key Management */
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.EnrollAeadOnKeyRotation]: FALSE,
  [FeatureFlag.ForceUpdateKDFSettings]: FALSE,

  /* Platform */
  [FeatureFlag.IpcChannelFramework]: FALSE,
  [FeatureFlag.InactiveUserServerNotification]: FALSE,
  [FeatureFlag.PushNotificationsWhenLocked]: FALSE,
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
