export enum FeatureFlag {
  BrowserFilelessImport = "browser-fileless-import",
  ItemShare = "item-share",
  FlexibleCollectionsV1 = "flexible-collections-v-1", // v-1 is intentional
  BulkCollectionAccess = "bulk-collection-access",
  VaultOnboarding = "vault-onboarding",
  GeneratorToolsModernization = "generator-tools-modernization",
  KeyRotationImprovements = "key-rotation-improvements",
  FlexibleCollectionsMigration = "flexible-collections-migration",
  AC1607_PresentUserOffboardingSurvey = "AC-1607_present-user-offboarding-survey",
  ShowPaymentMethodWarningBanners = "show-payment-method-warning-banners",
}

// Replace this with a type safe lookup of the feature flag values in PM-2282
export type FeatureFlagValue = number | string | boolean;
