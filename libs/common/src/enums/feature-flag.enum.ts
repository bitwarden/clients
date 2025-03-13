/**
 * Feature flags.
 *
 * Flags MUST be short lived and SHALL be removed once enabled.
 */
export enum FeatureFlag {
  /* Admin Console Team */
  AccountDeprovisioning = "pm-10308-account-deprovisioning",
  VerifiedSsoDomainEndpoint = "pm-12337-refactor-sso-details-endpoint",
  LimitItemDeletion = "pm-15493-restrict-item-deletion-to-can-manage-permission",

  /* Autofill */
  BlockBrowserInjectionsByDomain = "block-browser-injections-by-domain",
  DelayFido2PageScriptInitWithinMv2 = "delay-fido2-page-script-init-within-mv2",
  EnableNewCardCombinedExpiryAutofill = "enable-new-card-combined-expiry-autofill",
  GenerateIdentityFillScriptRefactor = "generate-identity-fill-script-refactor",
  IdpAutoSubmitLogin = "idp-auto-submit-login",
  InlineMenuFieldQualification = "inline-menu-field-qualification",
  InlineMenuPositioningImprovements = "inline-menu-positioning-improvements",
  NotificationBarAddLoginImprovements = "notification-bar-add-login-improvements",
  NotificationRefresh = "notification-refresh",
  UseTreeWalkerApiForPageDetailsCollection = "use-tree-walker-api-for-page-details-collection",

  /* Tools */
  ItemShare = "item-share",
  CriticalApps = "pm-14466-risk-insights-critical-application",
  EnableRiskInsightsNotifications = "enable-risk-insights-notifications",
  DesktopSendUIRefresh = "desktop-send-ui-refresh",
  ExportAttachments = "export-attachments",

  /* Vault */
  PM9111ExtensionPersistAddEditForm = "pm-9111-extension-persist-add-edit-form",
  NewDeviceVerificationTemporaryDismiss = "new-device-temporary-dismiss",
  NewDeviceVerificationPermanentDismiss = "new-device-permanent-dismiss",
  VaultBulkManagementAction = "vault-bulk-management-action",
  SecurityTasks = "security-tasks",

  PM4154_BulkEncryptionService = "PM-4154-bulk-encryption-service",
  UnauthenticatedExtensionUIRefresh = "unauth-ui-refresh",
  CipherKeyEncryption = "cipher-key-encryption",
  TrialPaymentOptional = "PM-8163-trial-payment",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  ResellerManagedOrgAlert = "PM-15814-alert-owners-of-reseller-managed-orgs",
  AccountDeprovisioningBanner = "pm-17120-account-deprovisioning-admin-console-banner",
  PM15179_AddExistingOrgsFromProviderPortal = "pm-15179-add-existing-orgs-from-provider-portal",
  RecoveryCodeLogin = "pm-17128-recovery-code-login",
  PM12276_BreadcrumbEventLogs = "pm-12276-breadcrumbing-for-business-features",
}

export type AllowedFeatureFlagTypes = boolean | number | string;

// Helper to ensure the value is treated as a boolean.
const FALSE = false as boolean;

/**
 * Default value for feature flags.
 *
 * DO NOT enable previously disabled flags, REMOVE them instead.
 * We support true as a value as we prefer flags to "enable" not "disable".
 */
export const DefaultFeatureFlagValue = {
  /* Admin Console Team */
  [FeatureFlag.AccountDeprovisioning]: FALSE,
  [FeatureFlag.VerifiedSsoDomainEndpoint]: FALSE,
  [FeatureFlag.LimitItemDeletion]: FALSE,

  /* Autofill */
  [FeatureFlag.BlockBrowserInjectionsByDomain]: FALSE,
  [FeatureFlag.DelayFido2PageScriptInitWithinMv2]: FALSE,
  [FeatureFlag.EnableNewCardCombinedExpiryAutofill]: FALSE,
  [FeatureFlag.GenerateIdentityFillScriptRefactor]: FALSE,
  [FeatureFlag.IdpAutoSubmitLogin]: FALSE,
  [FeatureFlag.InlineMenuFieldQualification]: FALSE,
  [FeatureFlag.InlineMenuPositioningImprovements]: FALSE,
  [FeatureFlag.NotificationBarAddLoginImprovements]: FALSE,
  [FeatureFlag.NotificationRefresh]: FALSE,
  [FeatureFlag.UseTreeWalkerApiForPageDetailsCollection]: FALSE,

  /* Tools */
  [FeatureFlag.ItemShare]: FALSE,
  [FeatureFlag.CriticalApps]: FALSE,
  [FeatureFlag.EnableRiskInsightsNotifications]: FALSE,
  [FeatureFlag.DesktopSendUIRefresh]: FALSE,
  [FeatureFlag.ExportAttachments]: FALSE,

  /* Vault */
  [FeatureFlag.PM9111ExtensionPersistAddEditForm]: FALSE,
  [FeatureFlag.NewDeviceVerificationTemporaryDismiss]: FALSE,
  [FeatureFlag.NewDeviceVerificationPermanentDismiss]: FALSE,
  [FeatureFlag.VaultBulkManagementAction]: FALSE,
  [FeatureFlag.SecurityTasks]: FALSE,

  [FeatureFlag.PM4154_BulkEncryptionService]: FALSE,
  [FeatureFlag.UnauthenticatedExtensionUIRefresh]: FALSE,
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.ResellerManagedOrgAlert]: FALSE,
  [FeatureFlag.AccountDeprovisioningBanner]: FALSE,
  [FeatureFlag.PM15179_AddExistingOrgsFromProviderPortal]: FALSE,
  [FeatureFlag.RecoveryCodeLogin]: FALSE,
  [FeatureFlag.PM12276_BreadcrumbEventLogs]: FALSE,
} satisfies Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type DefaultFeatureFlagValueType = typeof DefaultFeatureFlagValue;

export type FeatureFlagValueType<Flag extends FeatureFlag> = DefaultFeatureFlagValueType[Flag];
