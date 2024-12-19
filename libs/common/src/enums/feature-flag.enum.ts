/**
 * Feature flags.
 *
 * Flags MUST be short lived and SHALL be removed once enabled.
 */
export enum FeatureFlag {
  BrowserFilelessImport = "browser-fileless-import",
  ItemShare = "item-share",
  GeneratorToolsModernization = "generator-tools-modernization",
  AC1795_UpdatedSubscriptionStatusSection = "AC-1795_updated-subscription-status-section",
  ExtensionRefresh = "extension-refresh",
  PersistPopupView = "persist-popup-view",
  PM4154_BulkEncryptionService = "PM-4154-bulk-encryption-service",
  UseTreeWalkerApiForPageDetailsCollection = "use-tree-walker-api-for-page-details-collection",
  EmailVerification = "email-verification",
  InlineMenuFieldQualification = "inline-menu-field-qualification",
  InlineMenuPositioningImprovements = "inline-menu-positioning-improvements",
  ProviderClientVaultPrivacyBanner = "ac-2833-provider-client-vault-privacy-banner",
  VaultBulkManagementAction = "vault-bulk-management-action",
  IdpAutoSubmitLogin = "idp-auto-submit-login",
  UnauthenticatedExtensionUIRefresh = "unauth-ui-refresh",
  GenerateIdentityFillScriptRefactor = "generate-identity-fill-script-refactor",
  EnableNewCardCombinedExpiryAutofill = "enable-new-card-combined-expiry-autofill",
  DelayFido2PageScriptInitWithinMv2 = "delay-fido2-page-script-init-within-mv2",
  AccountDeprovisioning = "pm-10308-account-deprovisioning",
  SSHKeyVaultItem = "ssh-key-vault-item",
  SSHAgent = "ssh-agent",
  NotificationBarAddLoginImprovements = "notification-bar-add-login-improvements",
  AC2476_DeprecateStripeSourcesAPI = "AC-2476-deprecate-stripe-sources-api",
  CipherKeyEncryption = "cipher-key-encryption",
  VerifiedSsoDomainEndpoint = "pm-12337-refactor-sso-details-endpoint",
  PM11901_RefactorSelfHostingLicenseUploader = "PM-11901-refactor-self-hosting-license-uploader",
  PM14505AdminConsoleIntegrationPage = "pm-14505-admin-console-integration-page",
  CriticalApps = "pm-14466-risk-insights-critical-application",
  TrialPaymentOptional = "PM-8163-trial-payment",
  SecurityTasks = "security-tasks",
  NewDeviceVerificationTemporaryDismiss = "new-device-temporary-dismiss",
  NewDeviceVerificationPermanentDismiss = "new-device-permanent-dismiss",
  DisableFreeFamiliesSponsorship = "PM-12274-disable-free-families-sponsorship",
  InlineMenuTotp = "inline-menu-totp",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  PM11360RemoveProviderExportPermission = "pm-11360-remove-provider-export-permission",
  PM12443RemovePagingLogic = "pm-12443-remove-paging-logic",
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
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
  [FeatureFlag.BrowserFilelessImport]: FALSE,
  [FeatureFlag.ItemShare]: FALSE,
  [FeatureFlag.GeneratorToolsModernization]: FALSE,
  [FeatureFlag.AC1795_UpdatedSubscriptionStatusSection]: FALSE,
  [FeatureFlag.ExtensionRefresh]: FALSE,
  [FeatureFlag.PersistPopupView]: FALSE,
  [FeatureFlag.PM4154_BulkEncryptionService]: FALSE,
  [FeatureFlag.UseTreeWalkerApiForPageDetailsCollection]: FALSE,
  [FeatureFlag.EmailVerification]: FALSE,
  [FeatureFlag.InlineMenuFieldQualification]: FALSE,
  [FeatureFlag.InlineMenuPositioningImprovements]: FALSE,
  [FeatureFlag.ProviderClientVaultPrivacyBanner]: FALSE,
  [FeatureFlag.VaultBulkManagementAction]: FALSE,
  [FeatureFlag.IdpAutoSubmitLogin]: FALSE,
  [FeatureFlag.UnauthenticatedExtensionUIRefresh]: FALSE,
  [FeatureFlag.GenerateIdentityFillScriptRefactor]: FALSE,
  [FeatureFlag.EnableNewCardCombinedExpiryAutofill]: FALSE,
  [FeatureFlag.DelayFido2PageScriptInitWithinMv2]: FALSE,
  [FeatureFlag.AccountDeprovisioning]: FALSE,
  [FeatureFlag.SSHKeyVaultItem]: FALSE,
  [FeatureFlag.SSHAgent]: FALSE,
  [FeatureFlag.NotificationBarAddLoginImprovements]: FALSE,
  [FeatureFlag.AC2476_DeprecateStripeSourcesAPI]: FALSE,
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.VerifiedSsoDomainEndpoint]: FALSE,
  [FeatureFlag.PM11901_RefactorSelfHostingLicenseUploader]: FALSE,
  [FeatureFlag.PM14505AdminConsoleIntegrationPage]: FALSE,
  [FeatureFlag.CriticalApps]: FALSE,
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.SecurityTasks]: FALSE,
  [FeatureFlag.NewDeviceVerificationTemporaryDismiss]: FALSE,
  [FeatureFlag.NewDeviceVerificationPermanentDismiss]: FALSE,
  [FeatureFlag.DisableFreeFamiliesSponsorship]: FALSE,
  [FeatureFlag.InlineMenuTotp]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.PM11360RemoveProviderExportPermission]: FALSE,
  [FeatureFlag.PM12443RemovePagingLogic]: FALSE,
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
} satisfies Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type DefaultFeatureFlagValueType = typeof DefaultFeatureFlagValue;

export type FeatureFlagValueType<Flag extends FeatureFlag> = DefaultFeatureFlagValueType[Flag];
