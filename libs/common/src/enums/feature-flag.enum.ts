/**
 * Feature flags.
 *
 * Flags MUST be short lived and SHALL be removed once enabled.
 */
export enum FeatureFlag {
  /* Admin Console Team */
  ProviderClientVaultPrivacyBanner = "ac-2833-provider-client-vault-privacy-banner",
  AccountDeprovisioning = "pm-10308-account-deprovisioning",
  VerifiedSsoDomainEndpoint = "pm-12337-refactor-sso-details-endpoint",
  PM14505AdminConsoleIntegrationPage = "pm-14505-admin-console-integration-page",

  /* Autofill */
  BlockBrowserInjectionsByDomain = "block-browser-injections-by-domain",
  DelayFido2PageScriptInitWithinMv2 = "delay-fido2-page-script-init-within-mv2",
  EnableNewCardCombinedExpiryAutofill = "enable-new-card-combined-expiry-autofill",
  GenerateIdentityFillScriptRefactor = "generate-identity-fill-script-refactor",
  IdpAutoSubmitLogin = "idp-auto-submit-login",
  InlineMenuFieldQualification = "inline-menu-field-qualification",
  InlineMenuPositioningImprovements = "inline-menu-positioning-improvements",
  InlineMenuTotp = "inline-menu-totp",
  NotificationBarAddLoginImprovements = "notification-bar-add-login-improvements",
  NotificationRefresh = "notification-refresh",
  UseTreeWalkerApiForPageDetailsCollection = "use-tree-walker-api-for-page-details-collection",

  ItemShare = "item-share",
  GeneratorToolsModernization = "generator-tools-modernization",
  AC1795_UpdatedSubscriptionStatusSection = "AC-1795_updated-subscription-status-section",
  ExtensionRefresh = "extension-refresh",
  PersistPopupView = "persist-popup-view",
  PM4154_BulkEncryptionService = "PM-4154-bulk-encryption-service",
  TwoFactorComponentRefactor = "two-factor-component-refactor",
  VaultBulkManagementAction = "vault-bulk-management-action",
  UnauthenticatedExtensionUIRefresh = "unauth-ui-refresh",
  SSHKeyVaultItem = "ssh-key-vault-item",
  SSHAgent = "ssh-agent",
  AC2476_DeprecateStripeSourcesAPI = "AC-2476-deprecate-stripe-sources-api",
  CipherKeyEncryption = "cipher-key-encryption",
  PM11901_RefactorSelfHostingLicenseUploader = "PM-11901-refactor-self-hosting-license-uploader",
  CriticalApps = "pm-14466-risk-insights-critical-application",
  TrialPaymentOptional = "PM-8163-trial-payment",
  SecurityTasks = "security-tasks",
  NewDeviceVerificationTemporaryDismiss = "new-device-temporary-dismiss",
  NewDeviceVerificationPermanentDismiss = "new-device-permanent-dismiss",
  DisableFreeFamiliesSponsorship = "PM-12274-disable-free-families-sponsorship",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  PM9111ExtensionPersistAddEditForm = "pm-9111-extension-persist-add-edit-form",
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  ResellerManagedOrgAlert = "PM-15814-alert-owners-of-reseller-managed-orgs",
  NewDeviceVerification = "new-device-verification",
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
  [FeatureFlag.ProviderClientVaultPrivacyBanner]: FALSE,
  [FeatureFlag.AccountDeprovisioning]: FALSE,
  [FeatureFlag.VerifiedSsoDomainEndpoint]: FALSE,
  [FeatureFlag.PM14505AdminConsoleIntegrationPage]: FALSE,

  /* Autofill */
  [FeatureFlag.BlockBrowserInjectionsByDomain]: FALSE,
  [FeatureFlag.DelayFido2PageScriptInitWithinMv2]: FALSE,
  [FeatureFlag.EnableNewCardCombinedExpiryAutofill]: FALSE,
  [FeatureFlag.GenerateIdentityFillScriptRefactor]: FALSE,
  [FeatureFlag.IdpAutoSubmitLogin]: FALSE,
  [FeatureFlag.InlineMenuFieldQualification]: FALSE,
  [FeatureFlag.InlineMenuPositioningImprovements]: FALSE,
  [FeatureFlag.InlineMenuTotp]: FALSE,
  [FeatureFlag.NotificationBarAddLoginImprovements]: FALSE,
  [FeatureFlag.NotificationRefresh]: FALSE,
  [FeatureFlag.UseTreeWalkerApiForPageDetailsCollection]: FALSE,

  [FeatureFlag.ItemShare]: FALSE,
  [FeatureFlag.GeneratorToolsModernization]: FALSE,
  [FeatureFlag.AC1795_UpdatedSubscriptionStatusSection]: FALSE,
  [FeatureFlag.ExtensionRefresh]: FALSE,
  [FeatureFlag.PersistPopupView]: FALSE,
  [FeatureFlag.PM4154_BulkEncryptionService]: FALSE,
  [FeatureFlag.TwoFactorComponentRefactor]: FALSE,
  [FeatureFlag.VaultBulkManagementAction]: FALSE,
  [FeatureFlag.UnauthenticatedExtensionUIRefresh]: FALSE,
  [FeatureFlag.SSHKeyVaultItem]: FALSE,
  [FeatureFlag.SSHAgent]: FALSE,
  [FeatureFlag.AC2476_DeprecateStripeSourcesAPI]: FALSE,
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM11901_RefactorSelfHostingLicenseUploader]: FALSE,
  [FeatureFlag.CriticalApps]: FALSE,
  [FeatureFlag.TrialPaymentOptional]: FALSE,
  [FeatureFlag.SecurityTasks]: FALSE,
  [FeatureFlag.NewDeviceVerificationTemporaryDismiss]: FALSE,
  [FeatureFlag.NewDeviceVerificationPermanentDismiss]: FALSE,
  [FeatureFlag.DisableFreeFamiliesSponsorship]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.PM9111ExtensionPersistAddEditForm]: FALSE,
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.ResellerManagedOrgAlert]: FALSE,
  [FeatureFlag.NewDeviceVerification]: FALSE,
} satisfies Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type DefaultFeatureFlagValueType = typeof DefaultFeatureFlagValue;

export type FeatureFlagValueType<Flag extends FeatureFlag> = DefaultFeatureFlagValueType[Flag];
