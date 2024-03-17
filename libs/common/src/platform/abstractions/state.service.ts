import { Observable } from "rxjs";

import { OrganizationData } from "../../admin-console/models/data/organization.data";
import { AdminAuthRequestStorable } from "../../auth/models/domain/admin-auth-req-storable";
import { ForceSetPasswordReason } from "../../auth/models/domain/force-set-password-reason";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { BiometricKey } from "../../auth/types/biometric-key";
import { EventData } from "../../models/data/event.data";
import { WindowState } from "../../models/domain/window-state";
import { GeneratorOptions } from "../../tools/generator/generator-options";
import { GeneratedPasswordHistory, PasswordGeneratorOptions } from "../../tools/generator/password";
import { UsernameGeneratorOptions } from "../../tools/generator/username";
import { SendData } from "../../tools/send/models/data/send.data";
import { SendView } from "../../tools/send/models/view/send.view";
import { UserId } from "../../types/guid";
import { DeviceKey, MasterKey } from "../../types/key";
import { CipherData } from "../../vault/models/data/cipher.data";
import { LocalData } from "../../vault/models/data/local.data";
import { CipherView } from "../../vault/models/view/cipher.view";
import { AddEditCipherInfo } from "../../vault/types/add-edit-cipher-info";
import { KdfType } from "../enums";
import { ServerConfigData } from "../models/data/server-config.data";
import { Account, AccountDecryptionOptions } from "../models/domain/account";
import { EncString } from "../models/domain/enc-string";
import { StorageOptions } from "../models/domain/storage-options";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

/**
 * Options for customizing the initiation behavior.
 */
export type InitOptions = {
  /**
   * Whether or not to run state migrations as part of the init process. Defaults to true.
   *
   * If false, the init method will instead wait for migrations to complete before doing its
   * other init operations. Make sure migrations have either already completed, or will complete
   * before calling {@link StateService.init} with `runMigrations: false`.
   */
  runMigrations?: boolean;
};

export abstract class StateService<T extends Account = Account> {
  accounts$: Observable<{ [userId: string]: T }>;
  activeAccount$: Observable<string>;
  /**
   * @deprecated use accountService.activeAccount$ instead
   */
  activeAccountUnlocked$: Observable<boolean>;

  addAccount: (account: T) => Promise<void>;
  setActiveUser: (userId: string) => Promise<void>;
  clean: (options?: StorageOptions) => Promise<UserId>;
  init: (initOptions?: InitOptions) => Promise<void>;

  getAddEditCipherInfo: (options?: StorageOptions) => Promise<AddEditCipherInfo>;
  setAddEditCipherInfo: (value: AddEditCipherInfo, options?: StorageOptions) => Promise<void>;
  getAlwaysShowDock: (options?: StorageOptions) => Promise<boolean>;
  setAlwaysShowDock: (value: boolean, options?: StorageOptions) => Promise<void>;

  getAutoConfirmFingerPrints: (options?: StorageOptions) => Promise<boolean>;
  setAutoConfirmFingerprints: (value: boolean, options?: StorageOptions) => Promise<void>;
  getBiometricFingerprintValidated: (options?: StorageOptions) => Promise<boolean>;
  setBiometricFingerprintValidated: (value: boolean, options?: StorageOptions) => Promise<void>;
  getConvertAccountToKeyConnector: (options?: StorageOptions) => Promise<boolean>;
  setConvertAccountToKeyConnector: (value: boolean, options?: StorageOptions) => Promise<void>;
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
  getDecryptedPasswordGenerationHistory: (
    options?: StorageOptions,
  ) => Promise<GeneratedPasswordHistory[]>;
  setDecryptedPasswordGenerationHistory: (
    value: GeneratedPasswordHistory[],
    options?: StorageOptions,
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
   * @deprecated Do not call this directly, use SendService
   */
  getDecryptedSends: (options?: StorageOptions) => Promise<SendView[]>;
  /**
   * @deprecated Do not call this directly, use SendService
   */
  setDecryptedSends: (value: SendView[], options?: StorageOptions) => Promise<void>;
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
  getDuckDuckGoSharedKey: (options?: StorageOptions) => Promise<string>;
  setDuckDuckGoSharedKey: (value: string, options?: StorageOptions) => Promise<void>;
  getDeviceKey: (options?: StorageOptions) => Promise<DeviceKey | null>;
  setDeviceKey: (value: DeviceKey | null, options?: StorageOptions) => Promise<void>;
  getAdminAuthRequest: (options?: StorageOptions) => Promise<AdminAuthRequestStorable | null>;
  setAdminAuthRequest: (
    adminAuthRequest: AdminAuthRequestStorable,
    options?: StorageOptions,
  ) => Promise<void>;
  getShouldTrustDevice: (options?: StorageOptions) => Promise<boolean | null>;
  setShouldTrustDevice: (value: boolean, options?: StorageOptions) => Promise<void>;
  getAccountDecryptionOptions: (
    options?: StorageOptions,
  ) => Promise<AccountDecryptionOptions | null>;
  setAccountDecryptionOptions: (
    value: AccountDecryptionOptions,
    options?: StorageOptions,
  ) => Promise<void>;
  getEmail: (options?: StorageOptions) => Promise<string>;
  setEmail: (value: string, options?: StorageOptions) => Promise<void>;
  getEmailVerified: (options?: StorageOptions) => Promise<boolean>;
  setEmailVerified: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableAlwaysOnTop: (options?: StorageOptions) => Promise<boolean>;
  setEnableAlwaysOnTop: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableBrowserIntegration: (options?: StorageOptions) => Promise<boolean>;
  setEnableBrowserIntegration: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableBrowserIntegrationFingerprint: (options?: StorageOptions) => Promise<boolean>;
  setEnableBrowserIntegrationFingerprint: (
    value: boolean,
    options?: StorageOptions,
  ) => Promise<void>;
  getEnableCloseToTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableCloseToTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableDuckDuckGoBrowserIntegration: (options?: StorageOptions) => Promise<boolean>;
  setEnableDuckDuckGoBrowserIntegration: (
    value: boolean,
    options?: StorageOptions,
  ) => Promise<void>;
  getEnableMinimizeToTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableMinimizeToTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableStartToTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableStartToTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEnableTray: (options?: StorageOptions) => Promise<boolean>;
  setEnableTray: (value: boolean, options?: StorageOptions) => Promise<void>;
  getEncryptedCiphers: (options?: StorageOptions) => Promise<{ [id: string]: CipherData }>;
  setEncryptedCiphers: (
    value: { [id: string]: CipherData },
    options?: StorageOptions,
  ) => Promise<void>;
  getEncryptedPasswordGenerationHistory: (
    options?: StorageOptions,
  ) => Promise<GeneratedPasswordHistory[]>;
  setEncryptedPasswordGenerationHistory: (
    value: GeneratedPasswordHistory[],
    options?: StorageOptions,
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
   * @deprecated Do not call this directly, use SendService
   */
  getEncryptedSends: (options?: StorageOptions) => Promise<{ [id: string]: SendData }>;
  /**
   * @deprecated Do not call this directly, use SendService
   */
  setEncryptedSends: (value: { [id: string]: SendData }, options?: StorageOptions) => Promise<void>;
  getEventCollection: (options?: StorageOptions) => Promise<EventData[]>;
  setEventCollection: (value: EventData[], options?: StorageOptions) => Promise<void>;
  getEverBeenUnlocked: (options?: StorageOptions) => Promise<boolean>;
  setEverBeenUnlocked: (value: boolean, options?: StorageOptions) => Promise<void>;
  getForceSetPasswordReason: (options?: StorageOptions) => Promise<ForceSetPasswordReason>;
  setForceSetPasswordReason: (
    value: ForceSetPasswordReason,
    options?: StorageOptions,
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
    options?: StorageOptions,
  ) => Promise<void>;
  getLocale: (options?: StorageOptions) => Promise<string>;
  setLocale: (value: string, options?: StorageOptions) => Promise<void>;
  getMainWindowSize: (options?: StorageOptions) => Promise<number>;
  setMainWindowSize: (value: number, options?: StorageOptions) => Promise<void>;
  getMinimizeOnCopyToClipboard: (options?: StorageOptions) => Promise<boolean>;
  setMinimizeOnCopyToClipboard: (value: boolean, options?: StorageOptions) => Promise<void>;
  getOpenAtLogin: (options?: StorageOptions) => Promise<boolean>;
  setOpenAtLogin: (value: boolean, options?: StorageOptions) => Promise<void>;
  getOrganizationInvitation: (options?: StorageOptions) => Promise<any>;
  setOrganizationInvitation: (value: any, options?: StorageOptions) => Promise<void>;
  /**
   * @deprecated Do not call this directly, use OrganizationService
   */
  getOrganizations: (options?: StorageOptions) => Promise<{ [id: string]: OrganizationData }>;
  /**
   * @deprecated Do not call this directly, use OrganizationService
   */
  setOrganizations: (
    value: { [id: string]: OrganizationData },
    options?: StorageOptions,
  ) => Promise<void>;
  getPasswordGenerationOptions: (options?: StorageOptions) => Promise<PasswordGeneratorOptions>;
  setPasswordGenerationOptions: (
    value: PasswordGeneratorOptions,
    options?: StorageOptions,
  ) => Promise<void>;
  getUsernameGenerationOptions: (options?: StorageOptions) => Promise<UsernameGeneratorOptions>;
  setUsernameGenerationOptions: (
    value: UsernameGeneratorOptions,
    options?: StorageOptions,
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
  getRememberedEmail: (options?: StorageOptions) => Promise<string>;
  setRememberedEmail: (value: string, options?: StorageOptions) => Promise<void>;
  getSecurityStamp: (options?: StorageOptions) => Promise<string>;
  setSecurityStamp: (value: string, options?: StorageOptions) => Promise<void>;
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
  /**
   * fetches string value of URL user tried to navigate to while unauthenticated.
   * @param options Defines the storage options for the URL; Defaults to session Storage.
   * @returns route called prior to successful login.
   */
  getDeepLinkRedirectUrl: (options?: StorageOptions) => Promise<string>;
  /**
   * Store URL in session storage by default, but can be configured. Developed to handle
   * unauthN interrupted navigation.
   * @param url URL of route
   * @param options Defines the storage options for the URL; Defaults to session Storage.
   */
  setDeepLinkRedirectUrl: (url: string, options?: StorageOptions) => Promise<void>;
  nextUpActiveUser: () => Promise<UserId>;
}
