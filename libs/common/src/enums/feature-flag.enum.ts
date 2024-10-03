/**
 * Feature flags.
 *
 * Flags MUST be short lived and SHALL be removed once enabled.
 */
export enum FeatureFlag {
  BrowserFilelessImport = "browser-fileless-import",
  ItemShare = "item-share",
  GeneratorToolsModernization = "generator-tools-modernization",
  EnableConsolidatedBilling = "enable-consolidated-billing",
  AC1795_UpdatedSubscriptionStatusSection = "AC-1795_updated-subscription-status-section",
  EnableDeleteProvider = "AC-1218-delete-provider",
  ExtensionRefresh = "extension-refresh",
  PersistPopupView = "persist-popup-view",
  PM4154_BulkEncryptionService = "PM-4154-bulk-encryption-service",
  UseTreeWalkerApiForPageDetailsCollection = "use-tree-walker-api-for-page-details-collection",
  EmailVerification = "email-verification",
  InlineMenuFieldQualification = "inline-menu-field-qualification",
  MemberAccessReport = "ac-2059-member-access-report",
  TwoFactorComponentRefactor = "two-factor-component-refactor",
  EnableTimeThreshold = "PM-5864-dollar-threshold",
  InlineMenuPositioningImprovements = "inline-menu-positioning-improvements",
  ProviderClientVaultPrivacyBanner = "ac-2833-provider-client-vault-privacy-banner",
  VaultBulkManagementAction = "vault-bulk-management-action",
  AC2828_ProviderPortalMembersPage = "AC-2828_provider-portal-members-page",
  IdpAutoSubmitLogin = "idp-auto-submit-login",
  UnauthenticatedExtensionUIRefresh = "unauth-ui-refresh",
  EnableUpgradePasswordManagerSub = "AC-2708-upgrade-password-manager-sub",
  GenerateIdentityFillScriptRefactor = "generate-identity-fill-script-refactor",
  EnableNewCardCombinedExpiryAutofill = "enable-new-card-combined-expiry-autofill",
  DelayFido2PageScriptInitWithinMv2 = "delay-fido2-page-script-init-within-mv2",
  AccountDeprovisioning = "pm-10308-account-deprovisioning",
  SSHKeyVaultItem = "ssh-key-vault-item",
  NotificationBarAddLoginImprovements = "notification-bar-add-login-improvements",
  AC2476_DeprecateStripeSourcesAPI = "AC-2476-deprecate-stripe-sources-api",
  CipherKeyEncryption = "cipher-key-encryption",
  PM11901_RefactorSelfHostingLicenseUploader = "PM-11901-refactor-self-hosting-license-uploader",
  Pm3478RefactorOrganizationUserApi = "pm-3478-refactor-organizationuser-api",
}

export type AllowedFeatureFlagTypes = boolean | number | string;

// Helper to ensure the value is treated as a boolean.
const FALSE = false as boolean;
const TRUE = true as boolean;

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
  [FeatureFlag.EnableConsolidatedBilling]: FALSE,
  [FeatureFlag.AC1795_UpdatedSubscriptionStatusSection]: FALSE,
  [FeatureFlag.EnableDeleteProvider]: FALSE,
  [FeatureFlag.ExtensionRefresh]: FALSE,
  [FeatureFlag.PersistPopupView]: FALSE,
  [FeatureFlag.PM4154_BulkEncryptionService]: FALSE,
  [FeatureFlag.UseTreeWalkerApiForPageDetailsCollection]: FALSE,
  [FeatureFlag.EmailVerification]: FALSE,
  [FeatureFlag.InlineMenuFieldQualification]: FALSE,
  [FeatureFlag.MemberAccessReport]: FALSE,
  [FeatureFlag.TwoFactorComponentRefactor]: FALSE,
  [FeatureFlag.EnableTimeThreshold]: FALSE,
  [FeatureFlag.InlineMenuPositioningImprovements]: FALSE,
  [FeatureFlag.ProviderClientVaultPrivacyBanner]: FALSE,
  [FeatureFlag.VaultBulkManagementAction]: FALSE,
  [FeatureFlag.AC2828_ProviderPortalMembersPage]: FALSE,
  [FeatureFlag.IdpAutoSubmitLogin]: FALSE,
  [FeatureFlag.UnauthenticatedExtensionUIRefresh]: FALSE,
  [FeatureFlag.EnableUpgradePasswordManagerSub]: FALSE,
  [FeatureFlag.GenerateIdentityFillScriptRefactor]: FALSE,
  [FeatureFlag.EnableNewCardCombinedExpiryAutofill]: FALSE,
  [FeatureFlag.DelayFido2PageScriptInitWithinMv2]: FALSE,
  [FeatureFlag.AccountDeprovisioning]: FALSE,
  [FeatureFlag.SSHKeyVaultItem]: TRUE,
  [FeatureFlag.NotificationBarAddLoginImprovements]: FALSE,
  [FeatureFlag.AC2476_DeprecateStripeSourcesAPI]: FALSE,
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM11901_RefactorSelfHostingLicenseUploader]: FALSE,
  [FeatureFlag.Pm3478RefactorOrganizationUserApi]: FALSE,
} satisfies Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type DefaultFeatureFlagValueType = typeof DefaultFeatureFlagValue;

export type FeatureFlagValueType<Flag extends FeatureFlag> = DefaultFeatureFlagValueType[Flag];
