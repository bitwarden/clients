import * as fs from "fs";
import * as path from "path";

import * as program from "commander";
import * as jsdom from "jsdom";

import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/services/organization/organization.service";
import { PolicyApiService } from "@bitwarden/common/admin-console/services/policy/policy-api.service";
import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";
import { ProviderService } from "@bitwarden/common/admin-console/services/provider.service";
import { AuthRequestCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth-request-crypto.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { AuthRequestCryptoServiceImplementation } from "@bitwarden/common/auth/services/auth-request-crypto.service.implementation";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { DeviceTrustCryptoService } from "@bitwarden/common/auth/services/device-trust-crypto.service.implementation";
import { DevicesApiServiceImplementation } from "@bitwarden/common/auth/services/devices-api.service.implementation";
import { KeyConnectorService } from "@bitwarden/common/auth/services/key-connector.service";
import { TokenService } from "@bitwarden/common/auth/services/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/services/two-factor.service";
import { UserVerificationApiService } from "@bitwarden/common/auth/services/user-verification/user-verification-api.service";
import { UserVerificationService } from "@bitwarden/common/auth/services/user-verification/user-verification.service";
import { ClientType, KeySuffixOptions, LogLevelType } from "@bitwarden/common/enums";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Account } from "@bitwarden/common/platform/models/domain/account";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/services/broadcaster.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { CryptoService } from "@bitwarden/common/platform/services/crypto.service";
import { EncryptServiceImplementation } from "@bitwarden/common/platform/services/cryptography/encrypt.service.implementation";
import { EnvironmentService } from "@bitwarden/common/platform/services/environment.service";
import { FileUploadService } from "@bitwarden/common/platform/services/file-upload/file-upload.service";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";
import { NoopMessagingService } from "@bitwarden/common/platform/services/noop-messaging.service";
import { StateService } from "@bitwarden/common/platform/services/state.service";
import { AuditService } from "@bitwarden/common/services/audit.service";
import { OrganizationUserServiceImplementation } from "@bitwarden/common/services/organization-user/organization-user.service.implementation";
import { SearchService } from "@bitwarden/common/services/search.service";
import { SettingsService } from "@bitwarden/common/services/settings.service";
import { TotpService } from "@bitwarden/common/services/totp.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/services/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vault-timeout/vault-timeout.service";
import {
  PasswordGenerationService,
  PasswordGenerationServiceAbstraction,
} from "@bitwarden/common/tools/generator/password";
import {
  PasswordStrengthService,
  PasswordStrengthServiceAbstraction,
} from "@bitwarden/common/tools/password-strength";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/services/collection.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/services/file-upload/cipher-file-upload.service";
import { FolderApiService } from "@bitwarden/common/vault/services/folder/folder-api.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { SyncNotifierService } from "@bitwarden/common/vault/services/sync/sync-notifier.service";
import { SyncService } from "@bitwarden/common/vault/services/sync/sync.service";
import {
  VaultExportService,
  VaultExportServiceAbstraction,
} from "@bitwarden/exporter/vault-export";
import {
  ImportApiService,
  ImportApiServiceAbstraction,
  ImportService,
  ImportServiceAbstraction,
} from "@bitwarden/importer";
import { NodeCryptoFunctionService } from "@bitwarden/node/services/node-crypto-function.service";

import { CliPlatformUtilsService } from "./platform/services/cli-platform-utils.service";
import { ConsoleLogService } from "./platform/services/console-log.service";
import { I18nService } from "./platform/services/i18n.service";
import { LowdbStorageService } from "./platform/services/lowdb-storage.service";
import { NodeApiService } from "./platform/services/node-api.service";
import { NodeEnvSecureStorageService } from "./platform/services/node-env-secure-storage.service";
import { Program } from "./program";
import { SendProgram } from "./tools/send/send.program";
import { VaultProgram } from "./vault.program";

// Polyfills
global.DOMParser = new jsdom.JSDOM().window.DOMParser;

// eslint-disable-next-line
const packageJson = require("../package.json");

export class Main {
  messagingService: NoopMessagingService;
  storageService: LowdbStorageService;
  secureStorageService: NodeEnvSecureStorageService;
  memoryStorageService: MemoryStorageService;
  i18nService: I18nService;
  platformUtilsService: CliPlatformUtilsService;
  cryptoService: CryptoService;
  tokenService: TokenService;
  appIdService: AppIdService;
  apiService: NodeApiService;
  environmentService: EnvironmentService;
  settingsService: SettingsService;
  cipherService: CipherService;
  folderService: InternalFolderService;
  organizationUserService: OrganizationUserService;
  collectionService: CollectionService;
  vaultTimeoutService: VaultTimeoutService;
  vaultTimeoutSettingsService: VaultTimeoutSettingsService;
  syncService: SyncService;
  passwordGenerationService: PasswordGenerationServiceAbstraction;
  passwordStrengthService: PasswordStrengthServiceAbstraction;
  totpService: TotpService;
  containerService: ContainerService;
  auditService: AuditService;
  importService: ImportServiceAbstraction;
  importApiService: ImportApiServiceAbstraction;
  exportService: VaultExportServiceAbstraction;
  searchService: SearchService;
  cryptoFunctionService: NodeCryptoFunctionService;
  encryptService: EncryptServiceImplementation;
  authService: AuthService;
  policyService: PolicyService;
  policyApiService: PolicyApiServiceAbstraction;
  program: Program;
  vaultProgram: VaultProgram;
  sendProgram: SendProgram;
  logService: ConsoleLogService;
  sendService: SendService;
  fileUploadService: FileUploadService;
  cipherFileUploadService: CipherFileUploadService;
  keyConnectorService: KeyConnectorService;
  userVerificationService: UserVerificationService;
  stateService: StateService;
  organizationService: OrganizationService;
  providerService: ProviderService;
  twoFactorService: TwoFactorService;
  broadcasterService: BroadcasterService;
  folderApiService: FolderApiService;
  userVerificationApiService: UserVerificationApiService;
  organizationApiService: OrganizationApiServiceAbstraction;
  syncNotifierService: SyncNotifierService;
  sendApiService: SendApiService;
  devicesApiService: DevicesApiServiceAbstraction;
  deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction;
  authRequestCryptoService: AuthRequestCryptoServiceAbstraction;

  constructor() {
    let p = null;
    const relativeDataDir = path.join(path.dirname(process.execPath), "bw-data");
    if (fs.existsSync(relativeDataDir)) {
      p = relativeDataDir;
    } else if (process.env.BITWARDENCLI_APPDATA_DIR) {
      p = path.resolve(process.env.BITWARDENCLI_APPDATA_DIR);
    } else if (process.platform === "darwin") {
      p = path.join(process.env.HOME, "Library/Application Support/Bitwarden CLI");
    } else if (process.platform === "win32") {
      p = path.join(process.env.APPDATA, "Bitwarden CLI");
    } else if (process.env.XDG_CONFIG_HOME) {
      p = path.join(process.env.XDG_CONFIG_HOME, "Bitwarden CLI");
    } else {
      p = path.join(process.env.HOME, ".config/Bitwarden CLI");
    }

    this.i18nService = new I18nService("en", "./locales");
    this.platformUtilsService = new CliPlatformUtilsService(ClientType.Cli, packageJson);
    this.logService = new ConsoleLogService(
      this.platformUtilsService.isDev(),
      (level) => process.env.BITWARDENCLI_DEBUG !== "true" && level <= LogLevelType.Info
    );
    this.cryptoFunctionService = new NodeCryptoFunctionService();
    this.encryptService = new EncryptServiceImplementation(
      this.cryptoFunctionService,
      this.logService,
      true
    );
    this.storageService = new LowdbStorageService(this.logService, null, p, false, true);
    this.secureStorageService = new NodeEnvSecureStorageService(
      this.storageService,
      this.logService,
      () => this.cryptoService
    );

    this.memoryStorageService = new MemoryStorageService();

    this.stateService = new StateService(
      this.storageService,
      this.secureStorageService,
      this.memoryStorageService,
      this.logService,
      new StateFactory(GlobalState, Account)
    );

    this.cryptoService = new CryptoService(
      this.cryptoFunctionService,
      this.encryptService,
      this.platformUtilsService,
      this.logService,
      this.stateService
    );

    this.appIdService = new AppIdService(this.storageService);
    this.tokenService = new TokenService(this.stateService);
    this.messagingService = new NoopMessagingService();
    this.environmentService = new EnvironmentService(this.stateService);

    const customUserAgent =
      "Bitwarden_CLI/" +
      this.platformUtilsService.getApplicationVersionSync() +
      " (" +
      this.platformUtilsService.getDeviceString().toUpperCase() +
      ")";
    this.apiService = new NodeApiService(
      this.tokenService,
      this.platformUtilsService,
      this.environmentService,
      this.appIdService,
      async (expired: boolean) => await this.logout(),
      customUserAgent
    );

    this.syncNotifierService = new SyncNotifierService();

    this.organizationApiService = new OrganizationApiService(this.apiService, this.syncService);

    this.containerService = new ContainerService(this.cryptoService, this.encryptService);

    this.settingsService = new SettingsService(this.stateService);

    this.fileUploadService = new FileUploadService(this.logService);

    this.sendService = new SendService(
      this.cryptoService,
      this.i18nService,
      this.cryptoFunctionService,
      this.stateService
    );

    this.cipherFileUploadService = new CipherFileUploadService(
      this.apiService,
      this.fileUploadService
    );

    this.sendApiService = this.sendApiService = new SendApiService(
      this.apiService,
      this.fileUploadService,
      this.sendService
    );

    this.searchService = new SearchService(this.logService, this.i18nService);

    this.cipherService = new CipherService(
      this.cryptoService,
      this.settingsService,
      this.apiService,
      this.i18nService,
      this.searchService,
      this.stateService,
      this.encryptService,
      this.cipherFileUploadService
    );

    this.broadcasterService = new BroadcasterService();

    this.folderService = new FolderService(
      this.cryptoService,
      this.i18nService,
      this.cipherService,
      this.stateService
    );

    this.folderApiService = new FolderApiService(this.folderService, this.apiService);

    this.collectionService = new CollectionService(
      this.cryptoService,
      this.i18nService,
      this.stateService
    );

    this.providerService = new ProviderService(this.stateService);

    this.organizationService = new OrganizationService(this.stateService);

    this.organizationUserService = new OrganizationUserServiceImplementation(this.apiService);

    this.policyService = new PolicyService(this.stateService, this.organizationService);

    this.policyApiService = new PolicyApiService(
      this.policyService,
      this.apiService,
      this.stateService
    );

    this.keyConnectorService = new KeyConnectorService(
      this.stateService,
      this.cryptoService,
      this.apiService,
      this.tokenService,
      this.logService,
      this.organizationService,
      this.cryptoFunctionService,
      async (expired: boolean) => await this.logout()
    );

    this.twoFactorService = new TwoFactorService(this.i18nService, this.platformUtilsService);

    this.passwordStrengthService = new PasswordStrengthService();

    this.passwordGenerationService = new PasswordGenerationService(
      this.cryptoService,
      this.policyService,
      this.stateService
    );

    this.devicesApiService = new DevicesApiServiceImplementation(this.apiService);
    this.deviceTrustCryptoService = new DeviceTrustCryptoService(
      this.cryptoFunctionService,
      this.cryptoService,
      this.encryptService,
      this.stateService,
      this.appIdService,
      this.devicesApiService,
      this.i18nService,
      this.platformUtilsService
    );

    this.authRequestCryptoService = new AuthRequestCryptoServiceImplementation(this.cryptoService);

    this.authService = new AuthService(
      this.cryptoService,
      this.apiService,
      this.tokenService,
      this.appIdService,
      this.platformUtilsService,
      this.messagingService,
      this.logService,
      this.keyConnectorService,
      this.environmentService,
      this.stateService,
      this.twoFactorService,
      this.i18nService,
      this.encryptService,
      this.passwordStrengthService,
      this.policyService,
      this.deviceTrustCryptoService,
      this.authRequestCryptoService
    );

    const lockedCallback = async (userId?: string) =>
      await this.cryptoService.clearStoredUserKey(KeySuffixOptions.Auto);

    this.userVerificationService = new UserVerificationService(
      this.stateService,
      this.cryptoService,
      this.i18nService,
      this.userVerificationApiService
    );

    this.vaultTimeoutSettingsService = new VaultTimeoutSettingsService(
      this.cryptoService,
      this.tokenService,
      this.policyService,
      this.stateService,
      this.userVerificationService
    );

    this.vaultTimeoutService = new VaultTimeoutService(
      this.cipherService,
      this.folderService,
      this.collectionService,
      this.cryptoService,
      this.platformUtilsService,
      this.messagingService,
      this.searchService,
      this.stateService,
      this.authService,
      this.vaultTimeoutSettingsService,
      lockedCallback,
      null
    );

    this.syncService = new SyncService(
      this.apiService,
      this.settingsService,
      this.folderService,
      this.cipherService,
      this.cryptoService,
      this.collectionService,
      this.messagingService,
      this.policyService,
      this.sendService,
      this.logService,
      this.keyConnectorService,
      this.stateService,
      this.providerService,
      this.folderApiService,
      this.organizationService,
      this.sendApiService,
      async (expired: boolean) => await this.logout()
    );

    this.totpService = new TotpService(this.cryptoFunctionService, this.logService);

    this.importApiService = new ImportApiService(this.apiService);

    this.importService = new ImportService(
      this.cipherService,
      this.folderService,
      this.importApiService,
      this.i18nService,
      this.collectionService,
      this.cryptoService
    );
    this.exportService = new VaultExportService(
      this.folderService,
      this.cipherService,
      this.apiService,
      this.cryptoService,
      this.cryptoFunctionService,
      this.stateService
    );

    this.auditService = new AuditService(this.cryptoFunctionService, this.apiService);
    this.program = new Program(this);
    this.vaultProgram = new VaultProgram(this);
    this.sendProgram = new SendProgram(this);

    this.userVerificationApiService = new UserVerificationApiService(this.apiService);
  }

  async run() {
    await this.init();

    await this.program.register();
    await this.vaultProgram.register();
    await this.sendProgram.register();

    program.parse(process.argv);

    if (process.argv.slice(2).length === 0) {
      program.outputHelp();
    }
  }

  async logout() {
    this.authService.logOut(() => {
      /* Do nothing */
    });
    const userId = await this.stateService.getUserId();
    await Promise.all([
      this.syncService.setLastSync(new Date(0)),
      this.cryptoService.clearKeys(),
      this.settingsService.clear(userId),
      this.cipherService.clear(userId),
      this.folderService.clear(userId),
      this.collectionService.clear(userId),
      this.policyService.clear(userId),
      this.passwordGenerationService.clear(),
    ]);
    await this.stateService.clean();
    process.env.BW_SESSION = null;
  }

  private async init() {
    await this.storageService.init();
    await this.stateService.init();
    this.containerService.attachToGlobal(global);
    await this.environmentService.setUrlsFromStorage();
    const locale = await this.stateService.getLocale();
    await this.i18nService.init(locale);
    this.twoFactorService.init();

    const installedVersion = await this.stateService.getInstalledVersion();
    const currentVersion = await this.platformUtilsService.getApplicationVersion();
    if (installedVersion == null || installedVersion !== currentVersion) {
      await this.stateService.setInstalledVersion(currentVersion);
    }
  }
}

const main = new Main();
main.run();
