import { Observable } from "rxjs";

import { EncryptedOrganizationKeyData } from "../../admin-console/models/data/encrypted-organization-key.data";
import { OrganizationData } from "../../admin-console/models/data/organization.data";
import { PolicyData } from "../../admin-console/models/data/policy.data";
import { ProviderData } from "../../admin-console/models/data/provider.data";
import { Policy } from "../../admin-console/models/domain/policy";
import { AdminAuthRequestStorable } from "../../auth/models/domain/admin-auth-req-storable";
import { EnvironmentUrls } from "../../auth/models/domain/environment-urls";
import { ForceResetPasswordReason } from "../../auth/models/domain/force-reset-password-reason";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { BiometricKey } from "../../auth/types/biometric-key";
import { KdfType, ThemeType, UriMatchType } from "../../enums";
import { EventData } from "../../models/data/event.data";
import { WindowState } from "../../models/domain/window-state";
import { GeneratorOptions } from "../../tools/generator/generator-options";
import { GeneratedPasswordHistory, PasswordGeneratorOptions } from "../../tools/generator/password";
import { UsernameGeneratorOptions } from "../../tools/generator/username";
import { SendData } from "../../tools/send/models/data/send.data";
import { SendView } from "../../tools/send/models/view/send.view";
import { CipherData } from "../../vault/models/data/cipher.data";
import { CollectionData } from "../../vault/models/data/collection.data";
import { FolderData } from "../../vault/models/data/folder.data";
import { LocalData } from "../../vault/models/data/local.data";
import { CipherView } from "../../vault/models/view/cipher.view";
import { CollectionView } from "../../vault/models/view/collection.view";
import { AddEditCipherInfo } from "../../vault/types/add-edit-cipher-info";
import { ServerConfigData } from "../models/data/server-config.data";
import {
  Account,
  AccountDecryptionOptions,
  AccountSettingsSettings,
} from "../models/domain/account";
import { EncString } from "../models/domain/enc-string";
import { StorageOptions } from "../models/domain/storage-options";
import {
  DeviceKey,
  MasterKey,
  SymmetricCryptoKey,
  UserKey,
} from "../models/domain/symmetric-crypto-key";

export abstract class StateService<T extends Account = Account> {
  accounts$: Observable<{ [userId: string]: T }>;
  activeAccount$: Observable<string>;
  activeAccountUnlocked$: Observable<boolean>;

  addAccount: (account: T) => Promise<void>;
  setActiveUser: (userId: string) => Promise<void>;
  clean: (options?: StorageOptions) => Promise<void>;
  init: () => Promise<void>;

  getAccessToken: (options?: StorageOptions) => Promise<string>;
  setAccessToken: (value: string, options?: StorageOptions) => Promise<void>;
  getAddEditCipherInfo: (options?: StorageOptions) => Promise<AddEditCipherInfo>;
  setAddEditCipherInfo: (value: AddEditCipherInfo, options?: StorageOptions) => Promise<void>;
  getAlwaysShowDock: (options?: StorageOptions) => Promise<boolean>;
  setAlwaysShowDock: (value: boolean, options?: StorageOptions) => Promise<void>;
  getApiKeyClientId: (options?: StorageOptions) => Promise<string>;
  setApiKeyClientId: (value: string, options?: StorageOptions) => Promise<void>;
  getApiKeyClientSecret: (options?: StorageOptions) => Promise<string>;
  setApiKeyClientSecret: (value: string, options?: StorageOptions) => Promise<void>;
  getAutoConfirmFingerPrints: (options?: StorageOptions) => Promise<boolean>;
  setAutoConfirmFingerprints: (value: boolean, options?: StorageOptions) => Promise<void>;
  getAutoFillOnPageLoadDefault: (options?: StorageOptions) => Promise<boolean>;
  setAutoFillOnPageLoadDefault: (value: boolean, options?: StorageOptions) => Promise<void>;
  getBiometricAwaitingAcceptance: (options?: StorageOptions) => Promise<boolean>;
  setBiometricAwaitingAcceptance: (value: boolean, options?: StorageOptions) => Promise<void>;
  getBiometricFingerprintValidated: (options?: StorageOptions) => Promise<boolean>;
  setBiometricFingerprintValidated: (value: boolean, options?: StorageOptions) => Promise<void>;
  getBiometricText: (options?: StorageOptions) => Promise<string>;
  setBiometricText: (value: string, options?: StorageOptions) => Promise<void>;
  getBiometricUnlock: (options?: StorageOptions) => Promise<boolean>;
  setBiometricUnlock: (value: boolean, options?: StorageOptions) => Promise<void>;
  getCanAccessPremium: (options?: StorageOptions) => Promise<boolean>;
  getHasPremiumPersonally: (options?: StorageOptions) => Promise<boolean>;
  setHasPremiumPersonally: (value: boolean, options?: StorageOptions) => Promise<void>;
  setHasPremiumFromOrganization: (value: boolean, options?: StorageOptions) => Promise<void>;
  getHasPremiumFromOrganization: (options?: StorageOptions) => Promise<boolean>;
  getClearClipboard: (options?: StorageOptions) => Promise<number>;
  setClearClipboard: (value: number, options?: StorageOptions) => Promise<void>;
  getCollapsedGroupings: (options?: StorageOptions) => Promise<string[]>;
  setCollapsedGroupings: (value: string[], options?: StorageOptions) => Promise<void>;
  getConvertAccountToKeyConnector: (options?: StorageOptions) => Promise<boolean>;
  setConvertAccountToKeyConnector: (value: boolean, options?: StorageOptions) => Promise<void>;
  /**
   * gets the user key
   */
  getUserKey: (options?: StorageOptions) => Promise<UserKey>;
  /**
   * Sets the user key
   */
  setUserKey: (value: UserKey, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the user's master key
   */
  getMasterKey: (options?: StorageOptions) => Promise<MasterKey>;
  /**
   * Sets the user's master key
   */
  setMasterKey: (value: MasterKey, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the user key encrypted by the master key
   */
  getMasterKeyEncryptedUserKey: (options?: StorageOptions) => Promise<string>;
  /**
   * Sets the user key encrypted by the master key
   */
  setMasterKeyEncryptedUserKey: (value: string, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the user's auto key
   */
  getUserKeyAutoUnlock: (options?: StorageOptions) => Promise<string>;
  /**
   * Sets the user's auto key
   */
  setUserKeyAutoUnlock: (value: string, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the user's biometric key
   */
  getUserKeyBiometric: (options?: StorageOptions) => Promise<string>;
  /**
   * Checks if the user has a biometric key available
   */
  hasUserKeyBiometric: (options?: StorageOptions) => Promise<boolean>;
  /**
   * Sets the user's biometric key
   */
  setUserKeyBiometric: (value: BiometricKey, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the user key encrypted by the Pin key.
   * Used when Lock with MP on Restart is disabled
   */
  getPinKeyEncryptedUserKey: (options?: StorageOptions) => Promise<EncString>;
  /**
   * Sets the user key encrypted by the Pin key.
   * Used when Lock with MP on Restart is disabled
   */
  setPinKeyEncryptedUserKey: (value: EncString, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the ephemeral version of the user key encrypted by the Pin key.
   * Used when Lock with MP on Restart is enabled
   */
  getPinKeyEncryptedUserKeyEphemeral: (options?: StorageOptions) => Promise<EncString>;
  /**
   * Sets the ephemeral version of the user key encrypted by the Pin key.
   * Used when Lock with MP on Restart is enabled
   */
  setPinKeyEncryptedUserKeyEphemeral: (value: EncString, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated For migration purposes only, use getUserKeyMasterKey instead
   */
  getEncryptedCryptoSymmetricKey: (options?: StorageOptions) => Promise<string>;
  /**
   * @deprecated For migration purposes only, use setUserKeyMasterKey instead
   */
  setEncryptedCryptoSymmetricKey: (value: string, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated For legacy purposes only, use getMasterKey instead
   */
  getCryptoMasterKey: (options?: StorageOptions) => Promise<SymmetricCryptoKey>;
  /**
   * @deprecated For migration purposes only, use getUserKeyAuto instead
   */
  getCryptoMasterKeyAuto: (options?: StorageOptions) => Promise<string>;
  /**
   * @deprecated For migration purposes only, use setUserKeyAuto instead
   */
  setCryptoMasterKeyAuto: (value: string, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated For migration purposes only, use getUserKeyBiometric instead
   */
  getCryptoMasterKeyBiometric: (options?: StorageOptions) => Promise<string>;
  /**
   * @deprecated For migration purposes only, use hasUserKeyBiometric instead
   */
  hasCryptoMasterKeyBiometric: (options?: StorageOptions) => Promise<boolean>;
  /**
   * @deprecated For migration purposes only, use setUserKeyBiometric instead
   */
  setCryptoMasterKeyBiometric: (value: BiometricKey, options?: StorageOptions) => Promise<void>;
  getDecryptedCiphers: (options?: StorageOptions) => Promise<CipherView[]>;
  setDecryptedCiphers: (value: CipherView[], options?: StorageOptions) => Promise<void>;
  getDecryptedCollections: (options?: StorageOptions) => Promise<CollectionView[]>;
  setDecryptedCollections: (value: CollectionView[], options?: StorageOptions) => Promise<void>;
  getDecryptedOrganizationKeys: (
    options?: StorageOptions
  ) => Promise<Map<string, SymmetricCryptoKey>>;
  setDecryptedOrganizationKeys: (
    value: Map<string, SymmetricCryptoKey>,
    options?: StorageOptions
  ) => Promise<void>;
  getDecryptedPasswordGenerationHistory: (
    options?: StorageOptions
  ) => Promise<GeneratedPasswordHistory[]>;
  setDecryptedPasswordGenerationHistory: (
    value: GeneratedPasswordHistory[],
    options?: StorageOptions
  ) => Promise<void>;
  /**
   * @deprecated For migration purposes only, use getDecryptedUserKeyPin instead
   */
  getDecryptedPinProtected: (options?: StorageOptions) => Promise<EncString>;
  /**
   * @deprecated For migration purposes only, use setDecryptedUserKeyPin instead
   */
  setDecryptedPinProtected: (value: EncString, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this, use PolicyService
   */
  getDecryptedPolicies: (options?: StorageOptions) => Promise<Policy[]>;
  /**
   * @deprecated Do not call this, use PolicyService
   */
  setDecryptedPolicies: (value: Policy[], options?: StorageOptions) => Promise<void>;
  getDecryptedPrivateKey: (options?: StorageOptions) => Promise<Uint8Array>;
  setDecryptedPrivateKey: (value: Uint8Array, options?: StorageOptions) => Promise<void>;
  getDecryptedProviderKeys: (options?: StorageOptions) => Promise<Map<string, SymmetricCryptoKey>>;
  setDecryptedProviderKeys: (
    value: Map<string, SymmetricCryptoKey>,
    options?: StorageOptions
  ) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use SendService
   */
  getDecryptedSends: (options?: StorageOptions) => Promise<SendView[]>;
  /**
   * @deprecated Do not call this directly, use SendService
   */
  setDecryptedSends: (value: SendView[], options?: StorageOptions) => Promise<void>;
  getDefaultUriMatch: (options?: StorageOptions) => Promise<UriMatchType>;
  setDefaultUriMatch: (value: UriMatchType, options?: StorageOptions) => Promise<void>;
  getDisableAddLoginNotification: (options?: StorageOptions) => Promise<boolean>;
  setDisableAddLoginNotification: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDisableAutoBiometricsPrompt: (options?: StorageOptions) => Promise<boolean>;
  setDisableAutoBiometricsPrompt: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDisableAutoTotpCopy: (options?: StorageOptions) => Promise<boolean>;
  setDisableAutoTotpCopy: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDisableBadgeCounter: (options?: StorageOptions) => Promise<boolean>;
  setDisableBadgeCounter: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDisableChangedPasswordNotification: (options?: StorageOptions) => Promise<boolean>;
  setDisableChangedPasswordNotification: (
    value: boolean,
    options?: StorageOptions
  ) => Promise<void>;
  getDisableContextMenuItem: (options?: StorageOptions) => Promise<boolean>;
  setDisableContextMenuItem: (value: boolean, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this, use SettingsService
   */
  getDisableFavicon: (options?: StorageOptions) => Promise<boolean>;
  /**
   * @deprecated Do not call this, use SettingsService
   */
  setDisableFavicon: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDisableGa: (options?: StorageOptions) => Promise<boolean>;
  setDisableGa: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDismissedAutofillCallout: (options?: StorageOptions) => Promise<boolean>;
  setDismissedAutofillCallout: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDontShowCardsCurrentTab: (options?: StorageOptions) => Promise<boolean>;
  setDontShowCardsCurrentTab: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDontShowIdentitiesCurrentTab: (options?: StorageOptions) => Promise<boolean>;
  setDontShowIdentitiesCurrentTab: (value: boolean, options?: StorageOptions) => Promise<void>;
  getDuckDuckGoSharedKey: (options?: StorageOptions) => Promise<string>;
  setDuckDuckGoSharedKey: (value: string, options?: StorageOptions) => Promise<void>;
  getDeviceKey: (options?: StorageOptions) => Promise<DeviceKey | null>;
  setDeviceKey: (value: DeviceKey | null, options?: StorageOptions) => Promise<void>;
  getAdminAuthRequest: (options?: StorageOptions) => Promise<AdminAuthRequestStorable | null>;
  setAdminAuthRequest: (
    adminAuthRequest: AdminAuthRequestStorable,
    options?: StorageOptions
  ) => Promise<void>;
  getShouldTrustDevice: (options?: StorageOptions) => Promise<boolean | null>;
  setShouldTrustDevice: (value: boolean, options?: StorageOptions) => Promise<void>;
  getAccountDecryptionOptions: (
    options?: StorageOptions
  ) => Promise<AccountDecryptionOptions | null>;
  setAccountDecryptionOptions: (
    value: AccountDecryptionOptions,
    options?: StorageOptions
  ) => Promise<void>;
  getEmail: (options?: StorageOptions) => Promise<string>;
  setEmail: (value: string, options?: StorageOptions) => Promise<void>;
  getEmailVerified: (options?: StorageOptions) => Promise<boolean>;
  setEmailVerified: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableAlwaysOnTop: (options?: StorageOptions) => Promise<boolean>;
  setEnableAlwaysOnTop: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableAutoFillOnPageLoad: (options?: StorageOptions) => Promise<boolean>;
  setEnableAutoFillOnPageLoad: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableBrowserIntegration: (options?: StorageOptions) => Promise<boolean>;
  setEnableBrowserIntegration: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableBrowserIntegrationFingerprint: (options?: StorageOptions) => Promise<boolean>;
  setEnableBrowserIntegrationFingerprint: (
    value: boolean,
    options?: StorageOptions
  ) => Promise<void>;
  getEnableCloseToTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableCloseToTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableDuckDuckGoBrowserIntegration: (options?: StorageOptions) => Promise<boolean>;
  setEnableDuckDuckGoBrowserIntegration: (
    value: boolean,
    options?: StorageOptions
  ) => Promise<void>;
  getEnableFullWidth: (options?: StorageOptions) => Promise<boolean>;
  setEnableFullWidth: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableMinimizeToTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableMinimizeToTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableStartToTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableStartToTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEncryptedCiphers: (options?: StorageOptions) => Promise<{ [id: string]: CipherData }>;
  setEncryptedCiphers: (
    value: { [id: string]: CipherData },
    options?: StorageOptions
  ) => Promise<void>;
  getEncryptedCollections: (options?: StorageOptions) => Promise<{ [id: string]: CollectionData }>;
  setEncryptedCollections: (
    value: { [id: string]: CollectionData },
    options?: StorageOptions
  ) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use FolderService
   */
  getEncryptedFolders: (options?: StorageOptions) => Promise<{ [id: string]: FolderData }>;
  /**
   * @deprecated Do not call this directly, use FolderService
   */
  setEncryptedFolders: (
    value: { [id: string]: FolderData },
    options?: StorageOptions
  ) => Promise<void>;
  getEncryptedOrganizationKeys: (
    options?: StorageOptions
  ) => Promise<{ [orgId: string]: EncryptedOrganizationKeyData }>;
  setEncryptedOrganizationKeys: (
    value: { [orgId: string]: EncryptedOrganizationKeyData },
    options?: StorageOptions
  ) => Promise<void>;
  getEncryptedPasswordGenerationHistory: (
    options?: StorageOptions
  ) => Promise<GeneratedPasswordHistory[]>;
  setEncryptedPasswordGenerationHistory: (
    value: GeneratedPasswordHistory[],
    options?: StorageOptions
  ) => Promise<void>;
  /**
   * @deprecated For migration purposes only, use getEncryptedUserKeyPin instead
   */
  getEncryptedPinProtected: (options?: StorageOptions) => Promise<string>;
  /**
   * @deprecated For migration purposes only, use setEncryptedUserKeyPin instead
   */
  setEncryptedPinProtected: (value: string, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use PolicyService
   */
  getEncryptedPolicies: (options?: StorageOptions) => Promise<{ [id: string]: PolicyData }>;
  /**
   * @deprecated Do not call this directly, use PolicyService
   */
  setEncryptedPolicies: (
    value: { [id: string]: PolicyData },
    options?: StorageOptions
  ) => Promise<void>;
  getEncryptedPrivateKey: (options?: StorageOptions) => Promise<string>;
  setEncryptedPrivateKey: (value: string, options?: StorageOptions) => Promise<void>;
  getEncryptedProviderKeys: (options?: StorageOptions) => Promise<any>;
  setEncryptedProviderKeys: (value: any, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use SendService
   */
  getEncryptedSends: (options?: StorageOptions) => Promise<{ [id: string]: SendData }>;
  /**
   * @deprecated Do not call this directly, use SendService
   */
  setEncryptedSends: (value: { [id: string]: SendData }, options?: StorageOptions) => Promise<void>;
  getEntityId: (options?: StorageOptions) => Promise<string>;
  setEntityId: (value: string, options?: StorageOptions) => Promise<void>;
  getEntityType: (options?: StorageOptions) => Promise<any>;
  setEntityType: (value: string, options?: StorageOptions) => Promise<void>;
  getEnvironmentUrls: (options?: StorageOptions) => Promise<EnvironmentUrls>;
  setEnvironmentUrls: (value: EnvironmentUrls, options?: StorageOptions) => Promise<void>;
  getRegion: (options?: StorageOptions) => Promise<string>;
  setRegion: (value: string, options?: StorageOptions) => Promise<void>;
  getEquivalentDomains: (options?: StorageOptions) => Promise<string[][]>;
  setEquivalentDomains: (value: string, options?: StorageOptions) => Promise<void>;
  getEventCollection: (options?: StorageOptions) => Promise<EventData[]>;
  setEventCollection: (value: EventData[], options?: StorageOptions) => Promise<void>;
  getEverHadUserKey: (options?: StorageOptions) => Promise<boolean>;
  setEverHadUserKey: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEverBeenUnlocked: (options?: StorageOptions) => Promise<boolean>;
  setEverBeenUnlocked: (value: boolean, options?: StorageOptions) => Promise<void>;
  getForcePasswordResetReason: (options?: StorageOptions) => Promise<ForceResetPasswordReason>;
  setForcePasswordResetReason: (
    value: ForceResetPasswordReason,
    options?: StorageOptions
  ) => Promise<void>;
  getInstalledVersion: (options?: StorageOptions) => Promise<string>;
  setInstalledVersion: (value: string, options?: StorageOptions) => Promise<void>;
  getIsAuthenticated: (options?: StorageOptions) => Promise<boolean>;
  getKdfConfig: (options?: StorageOptions) => Promise<KdfConfig>;
  setKdfConfig: (kdfConfig: KdfConfig, options?: StorageOptions) => Promise<void>;
  getKdfType: (options?: StorageOptions) => Promise<KdfType>;
  setKdfType: (value: KdfType, options?: StorageOptions) => Promise<void>;
  getKeyHash: (options?: StorageOptions) => Promise<string>;
  setKeyHash: (value: string, options?: StorageOptions) => Promise<void>;
  getLastActive: (options?: StorageOptions) => Promise<number>;
  setLastActive: (value: number, options?: StorageOptions) => Promise<void>;
  getLastSync: (options?: StorageOptions) => Promise<string>;
  setLastSync: (value: string, options?: StorageOptions) => Promise<void>;
  getLocalData: (options?: StorageOptions) => Promise<{ [cipherId: string]: LocalData }>;
  setLocalData: (
    value: { [cipherId: string]: LocalData },
    options?: StorageOptions
  ) => Promise<void>;
  getLocale: (options?: StorageOptions) => Promise<string>;
  setLocale: (value: string, options?: StorageOptions) => Promise<void>;
  getMainWindowSize: (options?: StorageOptions) => Promise<number>;
  setMainWindowSize: (value: number, options?: StorageOptions) => Promise<void>;
  getMinimizeOnCopyToClipboard: (options?: StorageOptions) => Promise<boolean>;
  setMinimizeOnCopyToClipboard: (value: boolean, options?: StorageOptions) => Promise<void>;
  getNeverDomains: (options?: StorageOptions) => Promise<{ [id: string]: any }>;
  setNeverDomains: (value: { [id: string]: any }, options?: StorageOptions) => Promise<void>;
  getNoAutoPromptBiometricsText: (options?: StorageOptions) => Promise<string>;
  setNoAutoPromptBiometricsText: (value: string, options?: StorageOptions) => Promise<void>;
  getOpenAtLogin: (options?: StorageOptions) => Promise<boolean>;
  setOpenAtLogin: (value: boolean, options?: StorageOptions) => Promise<void>;
  getOrganizationInvitation: (options?: StorageOptions) => Promise<any>;
  setOrganizationInvitation: (value: any, options?: StorageOptions) => Promise<void>;
  getEmergencyAccessInvitation: (options?: StorageOptions) => Promise<any>;
  setEmergencyAccessInvitation: (value: any, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use OrganizationService
   */
  getOrganizations: (options?: StorageOptions) => Promise<{ [id: string]: OrganizationData }>;
  /**
   * @deprecated Do not call this directly, use OrganizationService
   */
  setOrganizations: (
    value: { [id: string]: OrganizationData },
    options?: StorageOptions
  ) => Promise<void>;
  getPasswordGenerationOptions: (options?: StorageOptions) => Promise<PasswordGeneratorOptions>;
  setPasswordGenerationOptions: (
    value: PasswordGeneratorOptions,
    options?: StorageOptions
  ) => Promise<void>;
  getUsernameGenerationOptions: (options?: StorageOptions) => Promise<UsernameGeneratorOptions>;
  setUsernameGenerationOptions: (
    value: UsernameGeneratorOptions,
    options?: StorageOptions
  ) => Promise<void>;
  getGeneratorOptions: (options?: StorageOptions) => Promise<GeneratorOptions>;
  setGeneratorOptions: (value: GeneratorOptions, options?: StorageOptions) => Promise<void>;
  /**
   * Gets the user's Pin, encrypted by the user key
   */
  getProtectedPin: (options?: StorageOptions) => Promise<string>;
  /**
   * Sets the user's Pin, encrypted by the user key
   */
  setProtectedPin: (value: string, options?: StorageOptions) => Promise<void>;
  getProviders: (options?: StorageOptions) => Promise<{ [id: string]: ProviderData }>;
  setProviders: (value: { [id: string]: ProviderData }, options?: StorageOptions) => Promise<void>;
  getPublicKey: (options?: StorageOptions) => Promise<Uint8Array>;
  setPublicKey: (value: Uint8Array, options?: StorageOptions) => Promise<void>;
  getRefreshToken: (options?: StorageOptions) => Promise<string>;
  setRefreshToken: (value: string, options?: StorageOptions) => Promise<void>;
  getRememberedEmail: (options?: StorageOptions) => Promise<string>;
  setRememberedEmail: (value: string, options?: StorageOptions) => Promise<void>;
  getSecurityStamp: (options?: StorageOptions) => Promise<string>;
  setSecurityStamp: (value: string, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use SettingsService
   */
  getSettings: (options?: StorageOptions) => Promise<AccountSettingsSettings>;
  /**
   * @deprecated Do not call this directly, use SettingsService
   */
  setSettings: (value: AccountSettingsSettings, options?: StorageOptions) => Promise<void>;
  getSsoCodeVerifier: (options?: StorageOptions) => Promise<string>;
  setSsoCodeVerifier: (value: string, options?: StorageOptions) => Promise<void>;
  getSsoOrgIdentifier: (options?: StorageOptions) => Promise<string>;
  setSsoOrganizationIdentifier: (value: string, options?: StorageOptions) => Promise<void>;
  getSsoState: (options?: StorageOptions) => Promise<string>;
  setSsoState: (value: string, options?: StorageOptions) => Promise<void>;
  getUserSsoOrganizationIdentifier: (options?: StorageOptions) => Promise<string>;
  setUserSsoOrganizationIdentifier: (
    value: string | null,
    options?: StorageOptions
  ) => Promise<void>;
  getTheme: (options?: StorageOptions) => Promise<ThemeType>;
  setTheme: (value: ThemeType, options?: StorageOptions) => Promise<void>;
  getTwoFactorToken: (options?: StorageOptions) => Promise<string>;
  setTwoFactorToken: (value: string, options?: StorageOptions) => Promise<void>;
  getUserId: (options?: StorageOptions) => Promise<string>;
  getUsesKeyConnector: (options?: StorageOptions) => Promise<boolean>;
  setUsesKeyConnector: (value: boolean, options?: StorageOptions) => Promise<void>;
  getVaultTimeout: (options?: StorageOptions) => Promise<number>;
  setVaultTimeout: (value: number, options?: StorageOptions) => Promise<void>;
  getVaultTimeoutAction: (options?: StorageOptions) => Promise<string>;
  setVaultTimeoutAction: (value: string, options?: StorageOptions) => Promise<void>;
  getApproveLoginRequests: (options?: StorageOptions) => Promise<boolean>;
  setApproveLoginRequests: (value: boolean, options?: StorageOptions) => Promise<void>;
  getWindow: () => Promise<WindowState>;
  setWindow: (value: WindowState) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use ConfigService
   */
  getServerConfig: (options?: StorageOptions) => Promise<ServerConfigData>;
  /**
   * @deprecated Do not call this directly, use ConfigService
   */
  setServerConfig: (value: ServerConfigData, options?: StorageOptions) => Promise<void>;

  getAvatarColor: (options?: StorageOptions) => Promise<string | null | undefined>;
  setAvatarColor: (value: string, options?: StorageOptions) => Promise<void>;
  getActivateAutoFillOnPageLoadFromPolicy: (
    options?: StorageOptions
  ) => Promise<boolean | undefined>;
  setActivateAutoFillOnPageLoadFromPolicy: (
    value: boolean,
    options?: StorageOptions
  ) => Promise<void>;
  getSMOnboardingTasks: (
    options?: StorageOptions
  ) => Promise<Record<string, Record<string, boolean>>>;
  setSMOnboardingTasks: (
    value: Record<string, Record<string, boolean>>,
    options?: StorageOptions
  ) => Promise<void>;
}
