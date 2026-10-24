import { DefaultLogoutService, UserDecryptionOptionsService } from "@bitwarden/auth/common";
import { DefaultOrganizationService } from "@bitwarden/common/admin-console/services/organization/default-organization.service";
import { DefaultNewPolicyService } from "@bitwarden/common/admin-console/services/policy/default-new-policy.service";
import { DefaultPolicyService } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { DefaultActiveUserAccessor } from "@bitwarden/common/auth/services/default-active-user.accessor";
import { TokenService } from "@bitwarden/common/auth/services/token.service";
import { AutofillSettingsService } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DefaultDomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { DefaultAccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/default-account-cryptographic-state.service";
import { MasterPasswordService } from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { SharedUnlockSettingsService } from "@bitwarden/common/key-management/shared-unlock";
import { DefaultSharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock/default-shared-unlock-peer.service";
import { DefaultV2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/services/default-v2-upgrade-token-state.service";
import {
  DefaultVaultTimeoutService,
  DefaultVaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { DefaultTaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";
import { ConfigApiService } from "@bitwarden/common/platform/services/config/config-api.service";
import { DefaultConfigService } from "@bitwarden/common/platform/services/config/default-config.service";
import { FileUploadService } from "@bitwarden/common/platform/services/file-upload/file-upload.service";
import { DefaultSdkClientFactory } from "@bitwarden/common/platform/services/sdk/default-sdk-client-factory";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { DefaultRegisterSdkService } from "@bitwarden/common/platform/services/sdk/register-sdk.service";
import { SystemService } from "@bitwarden/common/platform/services/system.service";
import { DefaultCipherSdkService } from "@bitwarden/common/vault/services/cipher-sdk.service";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { DefaultCipherEncryptionService } from "@bitwarden/common/vault/services/default-cipher-encryption.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/services/file-upload/cipher-file-upload.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  BiometricStateService,
  BiometricsService,
  DefaultKdfConfigService,
  DefaultKeyService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  DefaultKeyGenerationService,
  DefaultLegacyCompatKeyService,
  EncryptServiceImplementation,
} from "@bitwarden/legacy-crypto";
// eslint-disable-next-line no-restricted-imports
import { NodeCryptoFunctionService } from "@bitwarden/legacy-crypto/node";
import { DefaultManagedSettingsService } from "@bitwarden/managed-settings";
import { GlobalStateProvider, SingleUserStateProvider, StateProvider } from "@bitwarden/state";
import { DefaultStateEventRunnerService, DefaultStateService } from "@bitwarden/state-internal";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { DefaultAutoUnlockService, DefaultLockService } from "@bitwarden/unlock";

import { MainProcessReloadService } from "../key-management/main-process-reload.service";
import { DesktopSessionTimeoutTypeService } from "../key-management/session-timeout/services/desktop-session-timeout-type.service";
import { MainUnlockService } from "../key-management/unlock/main-unlock.service";
import { MainPlatformUtilsService } from "../platform/main/main-platform-utils.service";
import { MainSecureStorageService } from "../platform/main/main-secure-storage.service";
import { NodeApiService } from "../platform/main/node-api.service";
import { SafeShell } from "../platform/main/safe-shell.main";

/**
 * Builds the non-Angular service stack the Electron main process needs to be the "session owner"
 * — holding the decrypted user key, the SDK client, the unlock flow, and the vault services the
 * SSH agent and shared-unlock peer run against. It mirrors the CLI's `ServiceContainer`, but takes
 * the storage/state/messaging primitives that `Main` already constructs instead of building them.
 */
export class MainServiceContainer {
  readonly platformUtilsService: MainPlatformUtilsService;
  readonly cryptoFunctionService: NodeCryptoFunctionService;
  readonly encryptService: EncryptServiceImplementation;
  readonly keyGenerationService: DefaultKeyGenerationService;
  readonly stateService: DefaultStateService;
  readonly tokenService: TokenService;
  readonly appIdService: AppIdService;
  readonly kdfConfigService: DefaultKdfConfigService;
  readonly accountCryptographicStateService: DefaultAccountCryptographicStateService;
  readonly v2UpgradeTokenStateService: DefaultV2UpgradeTokenStateService;
  readonly masterPasswordService: MasterPasswordService;
  readonly keyService: DefaultKeyService;
  readonly autoUnlockService: DefaultAutoUnlockService;
  readonly legacyCompatKeyService: DefaultLegacyCompatKeyService;
  readonly userDecryptionOptionsService: UserDecryptionOptionsService;
  readonly organizationService: DefaultOrganizationService;
  readonly newPolicyService: DefaultNewPolicyService;
  readonly policyService: DefaultPolicyService;
  readonly vaultTimeoutSettingsService: DefaultVaultTimeoutSettingsService;
  readonly apiService: NodeApiService;
  readonly configService: DefaultConfigService;
  readonly managedSettingsService: DefaultManagedSettingsService;
  readonly sdkClientFactory: DefaultSdkClientFactory;
  readonly sdkService: DefaultSdkService;
  readonly registerSdkService: DefaultRegisterSdkService;
  readonly domainSettingsService: DefaultDomainSettingsService;
  readonly autofillSettingsService: AutofillSettingsService;
  readonly restrictedItemTypesService: RestrictedItemTypesService;
  readonly cipherEncryptionService: DefaultCipherEncryptionService;
  readonly cipherSdkService: DefaultCipherSdkService;
  readonly cipherService: CipherService;
  readonly folderService: FolderService;
  readonly stateEventRunnerService: DefaultStateEventRunnerService;
  readonly lockService: DefaultLockService;
  readonly unlockService: MainUnlockService;
  readonly sharedUnlockPeerService: DefaultSharedUnlockPeerService;
  readonly vaultTimeoutService: DefaultVaultTimeoutService;
  readonly systemService: SystemService;
  readonly processReloadService: MainProcessReloadService;

  private readonly fileUploadService: FileUploadService;
  private readonly cipherFileUploadService: CipherFileUploadService;
  private readonly taskSchedulerService: DefaultTaskSchedulerService;
  readonly authService: AuthService;

  constructor(
    private readonly logService: LogService,
    private readonly i18nService: I18nService,
    private readonly storageService: AbstractStorageService,
    private readonly secureStorageService: MainSecureStorageService,
    private readonly storageServiceProvider: StorageServiceProvider,
    private readonly singleUserStateProvider: SingleUserStateProvider,
    private readonly globalStateProvider: GlobalStateProvider,
    readonly stateProvider: StateProvider,
    readonly accountService: AccountService,
    private readonly environmentService: EnvironmentService,
    private readonly messagingService: MessageSender,
    private readonly biometricsService: BiometricsService,
    private readonly biometricStateService: BiometricStateService,
    private readonly ipcService: IpcService,
    private readonly sharedUnlockSettingsService: SharedUnlockSettingsService,
    private readonly shell: SafeShell,
  ) {
    const logoutCallback = async () => await this.logout();
    const refreshAccessTokenErrorCallback = () => {
      throw new Error("Refresh Access token error");
    };

    this.platformUtilsService = new MainPlatformUtilsService(this.shell);
    this.cryptoFunctionService = new NodeCryptoFunctionService();
    this.encryptService = new EncryptServiceImplementation(
      this.cryptoFunctionService,
      this.logService,
      true,
    );
    this.keyGenerationService = new DefaultKeyGenerationService(this.cryptoFunctionService);

    const activeUserAccessor = new DefaultActiveUserAccessor(this.accountService);
    this.stateService = new DefaultStateService(
      this.storageService,
      this.secureStorageService,
      activeUserAccessor,
    );

    this.kdfConfigService = new DefaultKdfConfigService(this.stateProvider);
    this.accountCryptographicStateService = new DefaultAccountCryptographicStateService(
      this.stateProvider,
    );
    this.v2UpgradeTokenStateService = new DefaultV2UpgradeTokenStateService(this.stateProvider);
    this.masterPasswordService = new MasterPasswordService(
      this.stateProvider,
      this.keyGenerationService,
      this.cryptoFunctionService,
      this.accountService,
    );

    this.tokenService = new TokenService(
      this.singleUserStateProvider,
      this.globalStateProvider,
      this.platformUtilsService.supportsSecureStorage(),
      this.secureStorageService,
      this.encryptService,
      this.logService,
      logoutCallback,
    );

    this.appIdService = new AppIdService(this.storageService, this.logService);

    this.keyService = new DefaultKeyService(
      this.cryptoFunctionService,
      this.encryptService,
      this.platformUtilsService,
      this.logService,
      this.stateService,
      this.stateProvider,
      this.accountCryptographicStateService,
      this.biometricsService,
    );

    this.autoUnlockService = new DefaultAutoUnlockService(
      this.keyService,
      this.stateService,
      this.stateProvider,
      this.platformUtilsService,
      this.logService,
    );

    this.legacyCompatKeyService = new DefaultLegacyCompatKeyService(
      this.keyGenerationService,
      this.cryptoFunctionService,
      this.encryptService,
      this.logService,
      this.accountService,
      this.kdfConfigService,
      this.keyService,
    );

    this.userDecryptionOptionsService = new UserDecryptionOptionsService(
      this.singleUserStateProvider,
    );
    this.organizationService = new DefaultOrganizationService(this.stateProvider);
    this.newPolicyService = new DefaultNewPolicyService(this.stateProvider);

    this.managedSettingsService = new DefaultManagedSettingsService(SdkLoadService.Ready);
    this.sdkClientFactory = new DefaultSdkClientFactory();

    this.policyService = new DefaultPolicyService(
      this.stateProvider,
      this.organizationService,
      this.accountService,
      this.newPolicyService,
      () => this.sdkService,
    );

    const sessionTimeoutTypeService = new DesktopSessionTimeoutTypeService();
    this.vaultTimeoutSettingsService = new DefaultVaultTimeoutSettingsService(
      this.accountService,
      this.userDecryptionOptionsService,
      this.autoUnlockService,
      this.tokenService,
      this.policyService,
      this.biometricStateService,
      this.stateProvider,
      this.logService,
      VaultTimeoutStringType.Never, // default vault timeout
      sessionTimeoutTypeService,
    );

    const customUserAgent =
      "Bitwarden/" +
      this.platformUtilsService.getApplicationVersionSync() +
      " (" +
      this.platformUtilsService.getDeviceString().toUpperCase() +
      ")";

    this.apiService = new NodeApiService(
      this.tokenService,
      this.platformUtilsService,
      this.environmentService,
      this.appIdService,
      refreshAccessTokenErrorCallback,
      this.logService,
      logoutCallback,
      this.vaultTimeoutSettingsService,
      this.accountService,
      customUserAgent,
    );

    this.sdkService = new DefaultSdkService(
      this.sdkClientFactory,
      this.environmentService,
      this.platformUtilsService,
      this.accountService,
      () => this.kdfConfigService,
      () => this.keyService,
      () => this.accountCryptographicStateService,
      () => this.apiService,
      this.stateProvider,
      () => this.configService,
      this.v2UpgradeTokenStateService,
      this.managedSettingsService,
      this.appIdService,
      this.logService,
      customUserAgent,
    );

    const configApiService = new ConfigApiService(this.apiService);
    this.authService = new AuthService(
      this.accountService,
      this.messagingService,
      this.keyService,
      this.apiService,
      this.stateService,
      this.tokenService,
    );
    this.configService = new DefaultConfigService(
      configApiService,
      this.environmentService,
      this.logService,
      this.stateProvider,
      this.authService,
      this.sdkService,
    );

    this.domainSettingsService = new DefaultDomainSettingsService(
      this.stateProvider,
      this.policyService,
      this.accountService,
      this.configService,
      this.environmentService,
      this.authService,
    );

    this.restrictedItemTypesService = new RestrictedItemTypesService(
      this.accountService,
      this.organizationService,
      this.policyService,
    );

    this.autofillSettingsService = new AutofillSettingsService(
      this.stateProvider,
      this.policyService,
      this.accountService,
      this.restrictedItemTypesService,
      this.configService,
    );

    this.registerSdkService = new DefaultRegisterSdkService(
      this.sdkClientFactory,
      this.environmentService,
      this.platformUtilsService,
      this.accountService,
      this.apiService,
      this.stateProvider,
      this.configService,
      this.managedSettingsService,
      this.appIdService,
      customUserAgent,
    );

    this.fileUploadService = new FileUploadService(this.logService, this.apiService);

    this.cipherEncryptionService = new DefaultCipherEncryptionService(
      this.sdkService,
      this.logService,
    );
    this.cipherSdkService = new DefaultCipherSdkService(this.sdkService, this.logService);
    this.cipherFileUploadService = new CipherFileUploadService(
      this.apiService,
      this.fileUploadService,
      this.cipherSdkService,
    );

    this.cipherService = new CipherService(
      this.keyService,
      this.legacyCompatKeyService,
      this.domainSettingsService,
      this.apiService,
      this.i18nService,
      this.autofillSettingsService,
      this.encryptService,
      this.cipherFileUploadService,
      this.configService,
      this.stateProvider,
      this.accountService,
      this.logService,
      this.cipherEncryptionService,
      this.messagingService,
      this.cipherSdkService,
    );

    this.folderService = new FolderService(
      this.keyService,
      this.encryptService,
      this.i18nService,
      this.cipherService,
      this.stateProvider,
      this.logService,
    );

    this.stateEventRunnerService = new DefaultStateEventRunnerService(
      this.globalStateProvider,
      this.storageServiceProvider,
    );

    this.taskSchedulerService = new DefaultTaskSchedulerService(this.logService);
    this.systemService = new SystemService(
      this.platformUtilsService,
      this.autofillSettingsService,
      this.taskSchedulerService,
    );
    this.processReloadService = new MainProcessReloadService();

    const logoutService = new DefaultLogoutService(this.messagingService, this.logService);
    this.lockService = new DefaultLockService(
      this.accountService,
      this.biometricsService,
      this.vaultTimeoutSettingsService,
      logoutService,
      this.messagingService,
      this.folderService,
      this.stateEventRunnerService,
      this.cipherService,
      this.authService,
      this.systemService,
      this.processReloadService,
      this.logService,
      this.keyService,
    );

    this.unlockService = new MainUnlockService(
      this.registerSdkService,
      this.accountCryptographicStateService,
      this.kdfConfigService,
      this.accountService,
      this.masterPasswordService,
      this.stateProvider,
      this.logService,
      this.biometricsService,
      this.biometricStateService,
      this.v2UpgradeTokenStateService,
      this.autoUnlockService,
      this.messagingService,
    );

    this.sharedUnlockPeerService = new DefaultSharedUnlockPeerService(
      this.ipcService,
      this.accountService,
      this.lockService,
      this.platformUtilsService,
      this.vaultTimeoutSettingsService,
      this.environmentService,
      this.sharedUnlockSettingsService,
      this.unlockService,
      this.configService,
      this.stateProvider,
    );

    this.vaultTimeoutService = new DefaultVaultTimeoutService(
      this.accountService,
      this.platformUtilsService,
      this.authService,
      this.vaultTimeoutSettingsService,
      this.taskSchedulerService,
      this.logService,
      this.lockService,
      undefined,
    );
  }

  private async logout(): Promise<void> {
    this.authService.logOut(() => {});
  }
}
