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
  GenerateInviteLink = "pm-32497-generate-invite-link",
  PM35153CollectionSdkDecryption = "pm-35153-collection-sdk-decryption",
  PolicyDrawers = "pm-34804-policy-drawers",
  PoliciesInAcceptedState = "pm-34145-policies-in-accepted-state",

  /* Auth */
  SafariAccountSwitching = "pm-5594-safari-account-switching",
  PM30811_ChangeEmailNewAuthenticationApis = "pm-30811-change-email-new-authentication-apis",
  PM31088_MasterPasswordServiceEmitSalt = "pm-31088-master-password-service-emit-salt",
  PM32413_MultiClientPasswordManagement = "pm-32413-multi-client-password-management",
  PM34210_DesktopAddDevices = "pm-34210-desktop-add-devices",
  // TODO: PM-34091 - Remove this flag and its DefaultFeatureFlagValue entry below.
  PM4516_DevicesLastActivityDate = "pm-4516-devices-add-last-activity-date",

  /* Autofill */
  UseUndeterminedCipherScenarioTriggeringLogic = "undetermined-cipher-scenario-logic",
  MacOsNativeCredentialSync = "macos-native-credential-sync",
  EnableAutofillTriage = "enable-autofill-triage",
  FillAssistTargetingRules = "fill-assist-targeting-rules",

  /* Desktop Native */
  WindowsDesktopAutotype = "windows-desktop-autotype",
  WindowsDesktopAutotypeGA = "windows-desktop-autotype-ga",
  SSHAgentV2 = "ssh-agent-v2",
  SSHecdsa = "ssh-ecdsa",

  /* Billing */
  PM29108_EnablePersonalDiscounts = "pm-29108-enable-personal-discounts",
  PM24032_NewNavigationPremiumUpgradeButton = "pm-24032-new-navigation-premium-upgrade-button",
  PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog = "pm-23713-premium-badge-opens-new-premium-upgrade-dialog",
  PM34515_BrowserDesktopCheckout = "pm-34515-browser-desktop-checkout",
  DebugDisableSelfHostPremiumCheck = "debug-disable-self-host-premium-check",
  PM29593_PremiumToOrganizationUpgrade = "pm-29593-premium-to-organization-upgrade",

  /* Key Management */
  PrivateKeyRegeneration = "pm-12241-private-key-regeneration",
  EnrollAeadOnKeyRotation = "enroll-aead-on-key-rotation",
  ForceUpdateKDFSettings = "pm-18021-force-update-kdf-settings",
  SdkKeyRotation = "pm-30144-sdk-key-rotation",
  LinuxBiometricsV2 = "pm-26340-linux-biometrics-v2",
  // Note: Shared unlock is divided into two parts. Leader and follower. The leader is gated behind part 1, and
  // does not have user facing changes. It is an emergency only roll-back flag. Part 2 is where users actually
  // get to use the feature.
  SharedUnlockPart1 = "innovation-sprint-shared-unlock-part-1",
  SharedUnlockPart2 = "innovation-sprint-shared-unlock-part-2",
  NoLogoutOnKdfChange = "pm-23995-no-logout-on-kdf-change",
  PM27279_V2RegistrationTdeJit = "pm-27279-v2-registration-tde-jit",
  EnableAccountEncryptionV2KeyConnectorRegistration = "enable-account-encryption-v2-key-connector-registration",
  EnableAccountEncryptionV2JitPasswordRegistration = "enable-account-encryption-v2-jit-password-registration",
  UnlockKeyConnectorWithSdk = "use-unlock-service-for-key-connector-login",
  SdkKeyConnectorMigration = "use-sdk-for-key-connector-migration",
  BiometricsSDKIPC = "biometrics-sdk-ipc",
  NoLogoutOnKeyUpgradeRotation = "pm-31050-no-logout-key-upgrade-rotation",
  ForceUpgradeV2Encryption = "force-upgrade-v2-encryption",
  EnableAccountEncryptionV2UserPasswordRegistration = "pm-27278-v2-password-registration",

  /* Tools */
  SendControls = "pm-31885-send-controls",
  Pm30110SdkSendsApi = "pm-30110-sdk-sends-api",
  SendEventLogging = "pm-36560-send-event-logging",

  /* DIRT */
  EventManagementForBlumira = "event-management-for-blumira",
  EventManagementForDataDogAndCrowdStrike = "event-management-for-datadog-and-crowdstrike",
  EventManagementForHuntress = "event-management-for-huntress",
  EventManagementForSplunk = "event-management-for-splunk",
  PhishingDetection = "phishing-detection",
  Milestone11AppPageImprovements = "pm-30538-dirt-milestone-11-app-page-improvements",
  AccessIntelligenceTrendChart = "pm-26961-access-intelligence-trend-chart",
  AccessIntelligenceNewArchitecture = "pm-31936-access-intelligence-new-architecture",
  AccessIntelligenceReportFileStorage = "pm-31920-access-intelligence-azure-file-storage",
  AccessIntelligenceAdoptionUxImprovements = "pm-34723-access-intelligence-adoption-ux-improvements",

  /* Vault */
  PM32009NewItemTypes = "pm-32009-new-item-types",
  PM28190CipherSharingOpsToSdk = "pm-28190-cipher-sharing-ops-to-sdk",
  PM22134SdkCipherListView = "pm-22134-sdk-cipher-list-view",
  CipherKeyEncryption = "cipher-key-encryption",
  PM27632_SdkCipherCrudOperations = "pm-27632-cipher-crud-operations-to-sdk",
  PM28191CipherAdminOpsToSdk = "pm-28191-cipher-admin-ops-to-sdk",
  PM28192_CipherAttachmentOpsToSdk = "pm-28192-cipher-attachment-ops-to-sdk",
  PM29438_DialogWithExtensionPromptAccountAge = "pm-29438-dialog-with-extension-prompt-account-age",
  PM31039ItemActionInExtension = "pm-31039-item-action-in-extension",
  PM32180PremiumUpsellAccountAge = "pm-32180-premium-upsell-account-age",
  PM28091_AddCopyAndQuickLaunchActions = "pm-28091-add-copy-and-quick-launch-actions",
  PM34500_StrictCipherDecryption = "pm-34500-strict-cipher-decryption",
  PM31948_OrgUserNotificationBanner = "pm-31948-org-user-notification-banner",
  PM29968_FillAfterSave = "pm-29968-fill-after-save",
  PM32016RemoveAtRiskCallout = "pm-32016-remove-at-risk-callout",
  PM37785_VaultBatchBar = "pm-37785-vault-batch-bar",
  PM37785_DesktopVaultBatchBar = "pm-37785-desktop-vault-batch-bar",
  PM32380_BtnTextAddCreate = "pm-32380-btn-text-add-create",

  /* Platform */
  FedRampGovRegion = "fedramp-gov-region",
  ContentScriptIpcChannelFramework = "content-script-ipc-channel-framework",
  WebAuthnRelatedOrigins = "pm-30529-webauthn-related-origins",
  PM34410AttachmentUploadProgress = "pm-34410-attachment-upload-progress",

  /* Innovation */
  ElectronStorageCache = "pm-32783-electron-storage-cache",

  /* Desktop */
  DesktopSettingsDialog = "desktop-ui-settings-dialog",
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
  [FeatureFlag.GenerateInviteLink]: FALSE,
  [FeatureFlag.PM35153CollectionSdkDecryption]: FALSE,
  [FeatureFlag.PolicyDrawers]: FALSE,
  [FeatureFlag.PoliciesInAcceptedState]: FALSE,

  /* Autofill */
  [FeatureFlag.FillAssistTargetingRules]: FALSE,
  [FeatureFlag.UseUndeterminedCipherScenarioTriggeringLogic]: FALSE,
  [FeatureFlag.MacOsNativeCredentialSync]: FALSE,
  [FeatureFlag.EnableAutofillTriage]: FALSE,
  [FeatureFlag.PM31039ItemActionInExtension]: FALSE,

  /* Desktop Native */
  [FeatureFlag.WindowsDesktopAutotype]: FALSE,
  [FeatureFlag.WindowsDesktopAutotypeGA]: FALSE,
  [FeatureFlag.SSHAgentV2]: FALSE,
  [FeatureFlag.SSHecdsa]: FALSE,

  /* Tools */
  [FeatureFlag.SendControls]: FALSE,
  [FeatureFlag.Pm30110SdkSendsApi]: FALSE,
  [FeatureFlag.SendEventLogging]: FALSE,

  /* DIRT */
  [FeatureFlag.EventManagementForBlumira]: FALSE,
  [FeatureFlag.EventManagementForDataDogAndCrowdStrike]: FALSE,
  [FeatureFlag.EventManagementForHuntress]: FALSE,
  [FeatureFlag.EventManagementForSplunk]: FALSE,
  [FeatureFlag.PhishingDetection]: FALSE,
  [FeatureFlag.Milestone11AppPageImprovements]: FALSE,
  [FeatureFlag.AccessIntelligenceTrendChart]: FALSE,
  [FeatureFlag.AccessIntelligenceNewArchitecture]: FALSE,
  [FeatureFlag.AccessIntelligenceReportFileStorage]: FALSE,
  [FeatureFlag.AccessIntelligenceAdoptionUxImprovements]: FALSE,

  /* Vault */
  [FeatureFlag.PM32009NewItemTypes]: FALSE,
  [FeatureFlag.CipherKeyEncryption]: FALSE,
  [FeatureFlag.PM22134SdkCipherListView]: FALSE,
  [FeatureFlag.PM27632_SdkCipherCrudOperations]: FALSE,
  [FeatureFlag.PM28191CipherAdminOpsToSdk]: FALSE,
  [FeatureFlag.PM28190CipherSharingOpsToSdk]: FALSE,
  [FeatureFlag.PM28192_CipherAttachmentOpsToSdk]: FALSE,
  [FeatureFlag.PM29438_DialogWithExtensionPromptAccountAge]: 5,
  [FeatureFlag.PM32180PremiumUpsellAccountAge]: 7,
  [FeatureFlag.PM28091_AddCopyAndQuickLaunchActions]: FALSE,
  [FeatureFlag.PM34500_StrictCipherDecryption]: FALSE,
  [FeatureFlag.PM31948_OrgUserNotificationBanner]: FALSE,
  [FeatureFlag.PM29968_FillAfterSave]: FALSE,
  [FeatureFlag.PM32016RemoveAtRiskCallout]: FALSE,
  [FeatureFlag.PM37785_VaultBatchBar]: FALSE,
  [FeatureFlag.PM37785_DesktopVaultBatchBar]: FALSE,
  [FeatureFlag.PM32380_BtnTextAddCreate]: FALSE,

  /* Auth */
  [FeatureFlag.SafariAccountSwitching]: FALSE,
  [FeatureFlag.PM30811_ChangeEmailNewAuthenticationApis]: FALSE,
  [FeatureFlag.PM31088_MasterPasswordServiceEmitSalt]: FALSE,
  [FeatureFlag.PM32413_MultiClientPasswordManagement]: FALSE,
  [FeatureFlag.PM34210_DesktopAddDevices]: FALSE,
  // TODO: PM-34091 - Remove this default value entry.
  [FeatureFlag.PM4516_DevicesLastActivityDate]: FALSE,

  /* Billing */
  [FeatureFlag.PM29108_EnablePersonalDiscounts]: FALSE,
  [FeatureFlag.PM24032_NewNavigationPremiumUpgradeButton]: FALSE,
  [FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog]: FALSE,
  [FeatureFlag.PM34515_BrowserDesktopCheckout]: FALSE,
  [FeatureFlag.DebugDisableSelfHostPremiumCheck]: FALSE,
  [FeatureFlag.PM29593_PremiumToOrganizationUpgrade]: FALSE,

  /* Key Management */
  [FeatureFlag.PrivateKeyRegeneration]: FALSE,
  [FeatureFlag.EnrollAeadOnKeyRotation]: FALSE,
  [FeatureFlag.ForceUpdateKDFSettings]: FALSE,
  [FeatureFlag.SdkKeyRotation]: FALSE,
  [FeatureFlag.SharedUnlockPart1]: FALSE,
  [FeatureFlag.SharedUnlockPart2]: FALSE,
  [FeatureFlag.LinuxBiometricsV2]: FALSE,
  [FeatureFlag.NoLogoutOnKdfChange]: FALSE,
  [FeatureFlag.NoLogoutOnKeyUpgradeRotation]: FALSE,
  [FeatureFlag.ForceUpgradeV2Encryption]: FALSE,
  [FeatureFlag.PM27279_V2RegistrationTdeJit]: FALSE,
  [FeatureFlag.EnableAccountEncryptionV2KeyConnectorRegistration]: FALSE,
  [FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration]: FALSE,
  [FeatureFlag.UnlockKeyConnectorWithSdk]: FALSE,
  [FeatureFlag.SdkKeyConnectorMigration]: FALSE,
  [FeatureFlag.BiometricsSDKIPC]: FALSE,
  [FeatureFlag.EnableAccountEncryptionV2UserPasswordRegistration]: FALSE,

  /* Platform */
  [FeatureFlag.FedRampGovRegion]: FALSE,
  [FeatureFlag.ContentScriptIpcChannelFramework]: FALSE,
  [FeatureFlag.WebAuthnRelatedOrigins]: FALSE,
  [FeatureFlag.PM34410AttachmentUploadProgress]: FALSE,

  /* Innovation */
  [FeatureFlag.ElectronStorageCache]: FALSE,

  /* Desktop */
  [FeatureFlag.DesktopSettingsDialog]: FALSE,
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
