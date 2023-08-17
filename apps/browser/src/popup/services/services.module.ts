import { APP_INITIALIZER, LOCALE_ID, NgModule } from "@angular/core";

import { LockGuard as BaseLockGuardService } from "@bitwarden/angular/auth/guards/lock.guard";
import { UnauthGuard as BaseUnauthGuardService } from "@bitwarden/angular/auth/guards/unauth.guard";
import { MEMORY_STORAGE, SECURE_STORAGE } from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import { ThemingService } from "@bitwarden/angular/services/theming/theming.service";
import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeout.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeoutSettings.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import {
  InternalPolicyService,
  PolicyService,
} from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { PolicyApiService } from "@bitwarden/common/admin-console/services/policy/policy-api.service";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { LoginService as LoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/login.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { LoginService } from "@bitwarden/common/auth/services/login.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { FileUploadService } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService as LogServiceAbstraction } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateMigrationService } from "@bitwarden/common/platform/abstractions/state-migration.service";
import {
  StateService as BaseStateServiceAbstraction,
  StateService,
} from "@bitwarden/common/platform/abstractions/state.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { SearchService } from "@bitwarden/common/services/search.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { UsernameGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/username";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import {
  InternalSendService as InternalSendServiceAbstraction,
  SendService,
} from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import {
  FolderService,
  InternalFolderService,
} from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PasswordRepromptService as PasswordRepromptServiceAbstraction } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { FolderApiService } from "@bitwarden/common/vault/services/folder/folder-api.service";
import { DialogService } from "@bitwarden/components";
import { VaultExportServiceAbstraction } from "@bitwarden/exporter/vault-export";

import { BrowserOrganizationService } from "../../admin-console/services/browser-organization.service";
import { BrowserPolicyService } from "../../admin-console/services/browser-policy.service";
import { LockGuardService, UnauthGuardService } from "../../auth/popup/services";
import { AutofillService } from "../../autofill/services/abstractions/autofill.service";
import MainBackground from "../../background/main.background";
import { Account } from "../../models/account";
import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserStateService as StateServiceAbstraction } from "../../platform/services/abstractions/browser-state.service";
import { BrowserConfigService } from "../../platform/services/browser-config.service";
import { BrowserEnvironmentService } from "../../platform/services/browser-environment.service";
import { BrowserFileDownloadService } from "../../platform/services/browser-file-download.service";
import { BrowserI18nService } from "../../platform/services/browser-i18n.service";
import BrowserMessagingPrivateModePopupService from "../../platform/services/browser-messaging-private-mode-popup.service";
import BrowserMessagingService from "../../platform/services/browser-messaging.service";
import { BrowserStateService } from "../../platform/services/browser-state.service";
import { BrowserSendService } from "../../services/browser-send.service";
import { BrowserSettingsService } from "../../services/browser-settings.service";
import { ForegroundFolderService } from "../../vault/popup/services/foreground-folder.service";
import { PasswordRepromptService } from "../../vault/popup/services/password-reprompt.service";
import { VaultFilterService } from "../../vault/services/vault-filter.service";

import { DebounceNavigationService } from "./debounceNavigationService";
import { InitService } from "./init.service";
import { PopupSearchService } from "./popup-search.service";
import { PopupUtilsService } from "./popup-utils.service";

const needsBackgroundInit = BrowserApi.getBackgroundPage() == null;
const isPrivateMode = needsBackgroundInit && BrowserApi.manifestVersion !== 3;
const mainBackground: MainBackground = needsBackgroundInit
  ? createLocalBgService()
  : BrowserApi.getBackgroundPage().bitwardenMain;

function createLocalBgService() {
  const localBgService = new MainBackground(isPrivateMode);
  localBgService.bootstrap();
  return localBgService;
}

function getBgService<T>(service: keyof MainBackground) {
  return (): T => {
    return mainBackground ? (mainBackground[service] as any as T) : null;
  };
}

@NgModule({
  imports: [JslibServicesModule],
  declarations: [],
  providers: [
    InitService,
    DebounceNavigationService,
    DialogService,
    {
      provide: LOCALE_ID,
      useFactory: () => getBgService<I18nServiceAbstraction>("i18nService")().translationLocale,
      deps: [],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (initService: InitService) => initService.init(),
      deps: [InitService],
      multi: true,
    },
    { provide: BaseLockGuardService, useClass: LockGuardService },
    { provide: BaseUnauthGuardService, useClass: UnauthGuardService },
    { provide: PopupUtilsService, useFactory: () => new PopupUtilsService(isPrivateMode) },
    {
      provide: MessagingService,
      useFactory: () => {
        return needsBackgroundInit
          ? new BrowserMessagingPrivateModePopupService()
          : new BrowserMessagingService();
      },
    },
    {
      provide: TwoFactorService,
      useFactory: getBgService<TwoFactorService>("twoFactorService"),
      deps: [],
    },
    {
      provide: AuthServiceAbstraction,
      useFactory: getBgService<AuthService>("authService"),
      deps: [],
    },
    {
      provide: SearchServiceAbstraction,
      useFactory: (logService: ConsoleLogService, i18nService: I18nServiceAbstraction) => {
        return new PopupSearchService(
          getBgService<SearchService>("searchService")(),
          logService,
          i18nService
        );
      },
      deps: [LogServiceAbstraction, I18nServiceAbstraction],
    },
    { provide: AuditService, useFactory: getBgService<AuditService>("auditService"), deps: [] },
    {
      provide: CipherFileUploadService,
      useFactory: getBgService<CipherFileUploadService>("cipherFileUploadService"),
      deps: [],
    },
    { provide: CipherService, useFactory: getBgService<CipherService>("cipherService"), deps: [] },
    {
      provide: CryptoFunctionService,
      useFactory: getBgService<CryptoFunctionService>("cryptoFunctionService"),
      deps: [],
    },
    {
      provide: FileUploadService,
      useFactory: getBgService<FileUploadService>("fileUploadService"),
    },
    {
      provide: ForegroundFolderService,
      useFactory: (
        cryptoService: CryptoService,
        i18nService: I18nServiceAbstraction,
        cipherService: CipherService,
        stateService: StateServiceAbstraction
      ) => {
        return new ForegroundFolderService(cryptoService, i18nService, cipherService, stateService);
      },
      deps: [CryptoService, I18nServiceAbstraction, CipherService, StateServiceAbstraction],
    },
    {
      provide: FolderService,
      useExisting: ForegroundFolderService,
    },
    {
      provide: InternalFolderService,
      useExisting: FolderService,
    },
    {
      provide: FolderApiServiceAbstraction,
      useFactory: (folderService: InternalFolderService, apiService: ApiService) => {
        return new FolderApiService(folderService, apiService);
      },
      deps: [InternalFolderService, ApiService],
    },
    {
      provide: CollectionService,
      useFactory: getBgService<CollectionService>("collectionService"),
      deps: [],
    },
    {
      provide: LogServiceAbstraction,
      useFactory: getBgService<ConsoleLogService>("logService"),
      deps: [],
    },
    {
      provide: BrowserEnvironmentService,
      useExisting: EnvironmentService,
    },
    {
      provide: EnvironmentService,
      useFactory: getBgService<EnvironmentService>("environmentService"),
      deps: [],
    },
    { provide: TotpService, useFactory: getBgService<TotpService>("totpService"), deps: [] },
    { provide: TokenService, useFactory: getBgService<TokenService>("tokenService"), deps: [] },
    {
      provide: I18nServiceAbstraction,
      useFactory: (stateService: BrowserStateService) => {
        return new BrowserI18nService(BrowserApi.getUILanguage(window), stateService);
      },
      deps: [StateService],
    },
    {
      provide: CryptoService,
      useFactory: (encryptService: EncryptService) => {
        const cryptoService = getBgService<CryptoService>("cryptoService")();
        new ContainerService(cryptoService, encryptService).attachToGlobal(self);
        return cryptoService;
      },
      deps: [EncryptService],
    },
    {
      provide: EventUploadService,
      useFactory: getBgService<EventUploadService>("eventUploadService"),
      deps: [],
    },
    {
      provide: EventCollectionService,
      useFactory: getBgService<EventCollectionService>("eventCollectionService"),
      deps: [],
    },
    {
      provide: PolicyService,
      useFactory: (
        stateService: StateServiceAbstraction,
        organizationService: OrganizationService
      ) => {
        return new BrowserPolicyService(stateService, organizationService);
      },
      deps: [StateServiceAbstraction, OrganizationService],
    },
    {
      provide: PolicyApiServiceAbstraction,
      useFactory: (
        policyService: InternalPolicyService,
        apiService: ApiService,
        stateService: StateService
      ) => {
        return new PolicyApiService(policyService, apiService, stateService);
      },
      deps: [InternalPolicyService, ApiService, StateService],
    },
    {
      provide: PlatformUtilsService,
      useFactory: getBgService<PlatformUtilsService>("platformUtilsService"),
      deps: [],
    },
    {
      provide: PasswordStrengthServiceAbstraction,
      useFactory: getBgService<PasswordStrengthServiceAbstraction>("passwordStrengthService"),
      deps: [],
    },
    {
      provide: PasswordGenerationServiceAbstraction,
      useFactory: getBgService<PasswordGenerationServiceAbstraction>("passwordGenerationService"),
      deps: [],
    },
    { provide: ApiService, useFactory: getBgService<ApiService>("apiService"), deps: [] },
    {
      provide: SendService,
      useFactory: (
        cryptoService: CryptoService,
        i18nService: I18nServiceAbstraction,
        cryptoFunctionService: CryptoFunctionService,
        stateServiceAbstraction: StateServiceAbstraction
      ) => {
        return new BrowserSendService(
          cryptoService,
          i18nService,
          cryptoFunctionService,
          stateServiceAbstraction
        );
      },
      deps: [CryptoService, I18nServiceAbstraction, CryptoFunctionService, StateServiceAbstraction],
    },
    {
      provide: InternalSendServiceAbstraction,
      useExisting: SendService,
    },
    {
      provide: SendApiServiceAbstraction,
      useFactory: (
        apiService: ApiService,
        fileUploadService: FileUploadService,
        sendService: InternalSendServiceAbstraction
      ) => {
        return new SendApiService(apiService, fileUploadService, sendService);
      },
      deps: [ApiService, FileUploadService, InternalSendServiceAbstraction],
    },
    { provide: SyncService, useFactory: getBgService<SyncService>("syncService"), deps: [] },
    {
      provide: SettingsService,
      useFactory: (stateService: StateServiceAbstraction) => {
        return new BrowserSettingsService(stateService);
      },
      deps: [StateServiceAbstraction],
    },
    {
      provide: AbstractStorageService,
      useFactory: getBgService<AbstractStorageService>("storageService"),
      deps: [],
    },
    { provide: AppIdService, useFactory: getBgService<AppIdService>("appIdService"), deps: [] },
    {
      provide: AutofillService,
      useFactory: getBgService<AutofillService>("autofillService"),
      deps: [],
    },
    {
      provide: VaultExportServiceAbstraction,
      useFactory: getBgService<VaultExportServiceAbstraction>("exportService"),
      deps: [],
    },
    {
      provide: KeyConnectorService,
      useFactory: getBgService<KeyConnectorService>("keyConnectorService"),
      deps: [],
    },
    {
      provide: UserVerificationService,
      useFactory: getBgService<UserVerificationService>("userVerificationService"),
      deps: [],
    },
    {
      provide: VaultTimeoutSettingsService,
      useFactory: getBgService<VaultTimeoutSettingsService>("vaultTimeoutSettingsService"),
      deps: [],
    },
    {
      provide: VaultTimeoutService,
      useFactory: getBgService<VaultTimeoutService>("vaultTimeoutService"),
      deps: [],
    },
    {
      provide: NotificationsService,
      useFactory: getBgService<NotificationsService>("notificationsService"),
      deps: [],
    },
    {
      provide: LogServiceAbstraction,
      useFactory: getBgService<ConsoleLogService>("logService"),
      deps: [],
    },
    { provide: PasswordRepromptServiceAbstraction, useClass: PasswordRepromptService },
    {
      provide: OrganizationService,
      useFactory: (stateService: StateServiceAbstraction) => {
        return new BrowserOrganizationService(stateService);
      },
      deps: [StateServiceAbstraction],
    },
    {
      provide: VaultFilterService,
      useFactory: (
        stateService: StateServiceAbstraction,
        organizationService: OrganizationService,
        folderService: FolderService,
        policyService: PolicyService
      ) => {
        return new VaultFilterService(
          stateService,
          organizationService,
          folderService,
          getBgService<CipherService>("cipherService")(),
          getBgService<CollectionService>("collectionService")(),
          policyService
        );
      },
      deps: [StateServiceAbstraction, OrganizationService, FolderService, PolicyService],
    },
    {
      provide: ProviderService,
      useFactory: getBgService<ProviderService>("providerService"),
      deps: [],
    },
    {
      provide: SECURE_STORAGE,
      useFactory: getBgService<AbstractStorageService>("secureStorageService"),
      deps: [],
    },
    {
      provide: MEMORY_STORAGE,
      useFactory: getBgService<AbstractStorageService>("memoryStorageService"),
    },
    {
      provide: StateMigrationService,
      useFactory: getBgService<StateMigrationService>("stateMigrationService"),
      deps: [],
    },
    {
      provide: StateServiceAbstraction,
      useFactory: (
        storageService: AbstractStorageService,
        secureStorageService: AbstractStorageService,
        memoryStorageService: AbstractMemoryStorageService,
        logService: LogServiceAbstraction,
        stateMigrationService: StateMigrationService
      ) => {
        return new BrowserStateService(
          storageService,
          secureStorageService,
          memoryStorageService,
          logService,
          stateMigrationService,
          new StateFactory(GlobalState, Account)
        );
      },
      deps: [
        AbstractStorageService,
        SECURE_STORAGE,
        MEMORY_STORAGE,
        LogServiceAbstraction,
        StateMigrationService,
      ],
    },
    {
      provide: UsernameGenerationServiceAbstraction,
      useFactory: getBgService<UsernameGenerationServiceAbstraction>("usernameGenerationService"),
      deps: [],
    },
    {
      provide: BaseStateServiceAbstraction,
      useExisting: StateServiceAbstraction,
      deps: [],
    },
    {
      provide: FileDownloadService,
      useClass: BrowserFileDownloadService,
    },
    {
      provide: LoginServiceAbstraction,
      useClass: LoginService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: AbstractThemingService,
      useFactory: (
        stateService: StateServiceAbstraction,
        platformUtilsService: PlatformUtilsService
      ) => {
        return new ThemingService(
          stateService,
          // Safari doesn't properly handle the (prefers-color-scheme) media query in the popup window, it always returns light.
          // In Safari we have to use the background page instead, which comes with limitations like not dynamically changing the extension theme when the system theme is changed.
          platformUtilsService.isSafari() ? getBgService<Window>("backgroundWindow")() : window,
          document
        );
      },
      deps: [StateServiceAbstraction, PlatformUtilsService],
    },
    {
      provide: ConfigServiceAbstraction,
      useClass: BrowserConfigService,
      deps: [
        StateServiceAbstraction,
        ConfigApiServiceAbstraction,
        AuthServiceAbstraction,
        EnvironmentService,
      ],
    },
  ],
})
export class ServicesModule {}
