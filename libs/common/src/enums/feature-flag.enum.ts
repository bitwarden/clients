/**
 * Feature flags.
 *
 * Flags MUST be short lived and SHALL be removed once enabled.
 */
export enum FeatureFlag {
  BrowserFilelessImport = "browser-fileless-import",
  ItemShare = "item-share",
  FlexibleCollectionsV1 = "flexible-collections-v-1", // v-1 is intentional
  GeneratorToolsModernization = "generator-tools-modernization",
  ShowPaymentMethodWarningBanners = "show-payment-method-warning-banners",
  EnableConsolidatedBilling = "enable-consolidated-billing",
  AC1795_UpdatedSubscriptionStatusSection = "AC-1795_updated-subscription-status-section",
  UnassignedItemsBanner = "unassigned-items-banner",
  EnableDeleteProvider = "AC-1218-delete-provider",
  ExtensionRefresh = "extension-refresh",
  PersistPopupView = "persist-popup-view",
  RestrictProviderAccess = "restrict-provider-access",
  UseTreeWalkerApiForPageDetailsCollection = "use-tree-walker-api-for-page-details-collection",
  BulkDeviceApproval = "bulk-device-approval",
  EmailVerification = "email-verification",
  InlineMenuFieldQualification = "inline-menu-field-qualification",
  MemberAccessReport = "ac-2059-member-access-report",
  EnableTimeThreshold = "PM-5864-dollar-threshold",
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
  [FeatureFlag.FlexibleCollectionsV1]: FALSE,
  [FeatureFlag.GeneratorToolsModernization]: FALSE,
  [FeatureFlag.ShowPaymentMethodWarningBanners]: FALSE,
  [FeatureFlag.EnableConsolidatedBilling]: FALSE,
  [FeatureFlag.AC1795_UpdatedSubscriptionStatusSection]: FALSE,
  [FeatureFlag.UnassignedItemsBanner]: FALSE,
  [FeatureFlag.EnableDeleteProvider]: FALSE,
  [FeatureFlag.ExtensionRefresh]: FALSE,
  [FeatureFlag.PersistPopupView]: FALSE,
  [FeatureFlag.RestrictProviderAccess]: FALSE,
  [FeatureFlag.UseTreeWalkerApiForPageDetailsCollection]: FALSE,
  [FeatureFlag.BulkDeviceApproval]: FALSE,
  [FeatureFlag.EmailVerification]: FALSE,
  [FeatureFlag.InlineMenuFieldQualification]: FALSE,
  [FeatureFlag.MemberAccessReport]: FALSE,
  [FeatureFlag.EnableTimeThreshold]: FALSE,
} satisfies Record<FeatureFlag, AllowedFeatureFlagTypes>;

export type DefaultFeatureFlagValueType = typeof DefaultFeatureFlagValue;

export type FeatureFlagValueType<Flag extends FeatureFlag> = DefaultFeatureFlagValueType[Flag];
