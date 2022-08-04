import { InjectionToken, Injector, LOCALE_ID, NgModule } from "@angular/core";

import { ThemingService } from "@bitwarden/angular/services/theming/theming.service";
import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { AbstractEncryptService } from "@bitwarden/common/abstractions/abstractEncrypt.service";
import { AccountApiService as AccountApiServiceAbstraction } from "@bitwarden/common/abstractions/account/account-api.service.abstraction";
import { AccountService as AccountServiceAbstraction } from "@bitwarden/common/abstractions/account/account.service.abstraction";
import { ApiService as ApiServiceAbstraction } from "@bitwarden/common/abstractions/api.service";
import { AppIdService as AppIdServiceAbstraction } from "@bitwarden/common/abstractions/appId.service";
import { AuditService as AuditServiceAbstraction } from "@bitwarden/common/abstractions/audit.service";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/abstractions/auth.service";
import { BroadcasterService as BroadcasterServiceAbstraction } from "@bitwarden/common/abstractions/broadcaster.service";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/abstractions/cipher.service";
import { CollectionService as CollectionServiceAbstraction } from "@bitwarden/common/abstractions/collection.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/abstractions/crypto.service";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { EnvironmentService as EnvironmentServiceAbstraction } from "@bitwarden/common/abstractions/environment.service";
import { EventService as EventServiceAbstraction } from "@bitwarden/common/abstractions/event.service";
import { ExportService as ExportServiceAbstraction } from "@bitwarden/common/abstractions/export.service";
import { FileUploadService as FileUploadServiceAbstraction } from "@bitwarden/common/abstractions/fileUpload.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/abstractions/folder/folder-api.service.abstraction";
import {
  FolderService as FolderServiceAbstraction,
  InternalFolderService,
} from "@bitwarden/common/abstractions/folder/folder.service.abstraction";
import { FormValidationErrorsService as FormValidationErrorsServiceAbstraction } from "@bitwarden/common/abstractions/formValidationErrors.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/abstractions/i18n.service";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "@bitwarden/common/abstractions/keyConnector.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/abstractions/messaging.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { OrganizationService as OrganizationServiceAbstraction } from "@bitwarden/common/abstractions/organization.service";
import { PasswordGenerationService as PasswordGenerationServiceAbstraction } from "@bitwarden/common/abstractions/passwordGeneration.service";
import { PasswordRepromptService as PasswordRepromptServiceAbstraction } from "@bitwarden/common/abstractions/passwordReprompt.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/abstractions/platformUtils.service";
import { PolicyService as PolicyServiceAbstraction } from "@bitwarden/common/abstractions/policy.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider-api.service.abstraction";
import { ProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
import { SendService as SendServiceAbstraction } from "@bitwarden/common/abstractions/send.service";
import { SettingsService as SettingsServiceAbstraction } from "@bitwarden/common/abstractions/settings.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/abstractions/state.service";
import { StateMigrationService as StateMigrationServiceAbstraction } from "@bitwarden/common/abstractions/stateMigration.service";
import { AbstractStorageService } from "@bitwarden/common/abstractions/storage.service";
import { SyncService as SyncServiceAbstraction } from "@bitwarden/common/abstractions/sync.service";
import { TokenService as TokenServiceAbstraction } from "@bitwarden/common/abstractions/token.service";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/abstractions/totp.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/abstractions/twoFactor.service";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/abstractions/userVerification.service";
import { UsernameGenerationService as UsernameGenerationServiceAbstraction } from "@bitwarden/common/abstractions/usernameGeneration.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "@bitwarden/common/abstractions/vaultTimeout.service";
import { StateFactory } from "@bitwarden/common/factories/stateFactory";
import { Account } from "@bitwarden/common/models/domain/account";
import { GlobalState } from "@bitwarden/common/models/domain/globalState";
import { AccountApiService } from "@bitwarden/common/services/account/account-api.service";
import { AccountService } from "@bitwarden/common/services/account/account.service";
import { ApiService } from "@bitwarden/common/services/api.service";
import { AppIdService } from "@bitwarden/common/services/appId.service";
import { AuditService } from "@bitwarden/common/services/audit.service";
import { AuthService } from "@bitwarden/common/services/auth.service";
import { CipherService } from "@bitwarden/common/services/cipher.service";
import { CollectionService } from "@bitwarden/common/services/collection.service";
import { ConsoleLogService } from "@bitwarden/common/services/consoleLog.service";
import { CryptoService } from "@bitwarden/common/services/crypto.service";
import { EncryptService } from "@bitwarden/common/services/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/services/environment.service";
import { EventService } from "@bitwarden/common/services/event.service";
import { ExportService } from "@bitwarden/common/services/export.service";
import { FileUploadService } from "@bitwarden/common/services/fileUpload.service";
import { FolderApiService } from "@bitwarden/common/services/folder/folder-api.service";
import { FolderService } from "@bitwarden/common/services/folder/folder.service";
import { FormValidationErrorsService } from "@bitwarden/common/services/formValidationErrors.service";
import { KeyConnectorService } from "@bitwarden/common/services/keyConnector.service";
import { NotificationsService } from "@bitwarden/common/services/notifications.service";
import { OrganizationService } from "@bitwarden/common/services/organization.service";
import { PasswordGenerationService } from "@bitwarden/common/services/passwordGeneration.service";
import { PolicyService } from "@bitwarden/common/services/policy.service";
import { ProviderApiService } from "@bitwarden/common/services/provider/provider-api.service";
import { ProviderService } from "@bitwarden/common/services/provider/provider.service";
import { SearchService } from "@bitwarden/common/services/search.service";
import { SendService } from "@bitwarden/common/services/send.service";
import { SettingsService } from "@bitwarden/common/services/settings.service";
import { StateService } from "@bitwarden/common/services/state.service";
import { StateMigrationService } from "@bitwarden/common/services/stateMigration.service";
import { SyncService } from "@bitwarden/common/services/sync.service";
import { TokenService } from "@bitwarden/common/services/token.service";
import { TotpService } from "@bitwarden/common/services/totp.service";
import { TwoFactorService } from "@bitwarden/common/services/twoFactor.service";
import { UserVerificationService } from "@bitwarden/common/services/userVerification.service";
import { UsernameGenerationService } from "@bitwarden/common/services/usernameGeneration.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vaultTimeout.service";
import { WebCryptoFunctionService } from "@bitwarden/common/services/webCryptoFunction.service";

import { AuthGuard } from "../guards/auth.guard";
import { LockGuard } from "../guards/lock.guard";
import { UnauthGuard } from "../guards/unauth.guard";

import { BroadcasterService } from "./broadcaster.service";
import { ModalService } from "./modal.service";
import { PasswordRepromptService } from "./passwordReprompt.service";
import { ValidationService } from "./validation.service";

export const WINDOW = new InjectionToken<Window>("WINDOW");
export const MEMORY_STORAGE = new InjectionToken<AbstractStorageService>("MEMORY_STORAGE");
export const SECURE_STORAGE = new InjectionToken<AbstractStorageService>("SECURE_STORAGE");
export const STATE_FACTORY = new InjectionToken<StateFactory>("STATE_FACTORY");
export const STATE_SERVICE_USE_CACHE = new InjectionToken<boolean>("STATE_SERVICE_USE_CACHE");
export const LOGOUT_CALLBACK = new InjectionToken<(expired: boolean, userId?: string) => void>(
  "LOGOUT_CALLBACK"
);
export const LOCKED_CALLBACK = new InjectionToken<() => void>("LOCKED_CALLBACK");
export const CLIENT_TYPE = new InjectionToken<boolean>("CLIENT_TYPE");
export const LOCALES_DIRECTORY = new InjectionToken<string>("LOCALES_DIRECTORY");
export const SYSTEM_LANGUAGE = new InjectionToken<string>("SYSTEM_LANGUAGE");
export const LOG_MAC_FAILURES = new InjectionToken<string>("LOG_MAC_FAILURES");

@NgModule({
  declarations: [],
  providers: [
    ValidationService,
    AuthGuard,
    UnauthGuard,
    LockGuard,
    ModalService,
    { provide: WINDOW, useValue: window },
    {
      provide: LOCALE_ID,
      useFactory: (i18nService: I18nServiceAbstraction) => i18nService.translationLocale,
      deps: [I18nServiceAbstraction],
    },
    {
      provide: LOCALES_DIRECTORY,
      useValue: "./locales",
    },
    {
      provide: SYSTEM_LANGUAGE,
      useFactory: (window: Window) => window.navigator.language,
      deps: [WINDOW],
    },
    {
      provide: STATE_FACTORY,
      useValue: new StateFactory(GlobalState, Account),
    },
    {
      provide: STATE_SERVICE_USE_CACHE,
      useValue: true,
    },
    {
      provide: LOGOUT_CALLBACK,
      useFactory:
        (messagingService: MessagingServiceAbstraction) => (expired: boolean, userId?: string) =>
          messagingService.send("logout", { expired: expired, userId: userId }),
      deps: [MessagingServiceAbstraction],
    },
    {
      provide: LOCKED_CALLBACK,
      useValue: null,
    },
    {
      provide: LOG_MAC_FAILURES,
      useValue: true,
    },
    {
      provide: AppIdServiceAbstraction,
      useClass: AppIdService,
      deps: [AbstractStorageService],
    },
    {
      provide: AuditServiceAbstraction,
      useClass: AuditService,
      deps: [CryptoFunctionServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: AuthServiceAbstraction,
      useClass: AuthService,
      deps: [
        CryptoServiceAbstraction,
        ApiServiceAbstraction,
        TokenServiceAbstraction,
        AppIdServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        MessagingServiceAbstraction,
        LogService,
        KeyConnectorServiceAbstraction,
        EnvironmentServiceAbstraction,
        StateServiceAbstraction,
        TwoFactorServiceAbstraction,
        I18nServiceAbstraction,
      ],
    },
    {
      provide: CipherServiceAbstraction,
      useFactory: (
        cryptoService: CryptoServiceAbstraction,
        settingsService: SettingsServiceAbstraction,
        apiService: ApiServiceAbstraction,
        fileUploadService: FileUploadServiceAbstraction,
        i18nService: I18nServiceAbstraction,
        injector: Injector,
        logService: LogService,
        stateService: StateServiceAbstraction
      ) =>
        new CipherService(
          cryptoService,
          settingsService,
          apiService,
          fileUploadService,
          i18nService,
          () => injector.get(SearchServiceAbstraction),
          logService,
          stateService
        ),
      deps: [
        CryptoServiceAbstraction,
        SettingsServiceAbstraction,
        ApiServiceAbstraction,
        FileUploadServiceAbstraction,
        I18nServiceAbstraction,
        Injector, // TODO: Get rid of this circular dependency!
        LogService,
        StateServiceAbstraction,
      ],
    },
    {
      provide: FolderServiceAbstraction,
      useClass: FolderService,
      deps: [
        CryptoServiceAbstraction,
        I18nServiceAbstraction,
        CipherServiceAbstraction,
        StateServiceAbstraction,
      ],
    },
    {
      provide: InternalFolderService,
      useExisting: FolderServiceAbstraction,
    },
    {
      provide: FolderApiServiceAbstraction,
      useClass: FolderApiService,
      deps: [FolderServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: AccountApiServiceAbstraction,
      useClass: AccountApiService,
      deps: [ApiServiceAbstraction],
    },
    {
      provide: AccountServiceAbstraction,
      useClass: AccountService,
      deps: [
        AccountApiServiceAbstraction,
        UserVerificationServiceAbstraction,
        MessagingServiceAbstraction,
        LogService,
      ],
    },
    { provide: LogService, useFactory: () => new ConsoleLogService(false) },
    {
      provide: CollectionServiceAbstraction,
      useClass: CollectionService,
      deps: [CryptoServiceAbstraction, I18nServiceAbstraction, StateServiceAbstraction],
    },
    {
      provide: EnvironmentServiceAbstraction,
      useClass: EnvironmentService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: TotpServiceAbstraction,
      useClass: TotpService,
      deps: [CryptoFunctionServiceAbstraction, LogService, StateServiceAbstraction],
    },
    { provide: TokenServiceAbstraction, useClass: TokenService, deps: [StateServiceAbstraction] },
    {
      provide: CryptoServiceAbstraction,
      useClass: CryptoService,
      deps: [
        CryptoFunctionServiceAbstraction,
        AbstractEncryptService,
        PlatformUtilsServiceAbstraction,
        LogService,
        StateServiceAbstraction,
      ],
    },
    {
      provide: PasswordGenerationServiceAbstraction,
      useClass: PasswordGenerationService,
      deps: [CryptoServiceAbstraction, PolicyServiceAbstraction, StateServiceAbstraction],
    },
    {
      provide: UsernameGenerationServiceAbstraction,
      useClass: UsernameGenerationService,
      deps: [CryptoServiceAbstraction, StateServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: ApiServiceAbstraction,
      useClass: ApiService,
      deps: [
        TokenServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        EnvironmentServiceAbstraction,
        AppIdServiceAbstraction,
        LOGOUT_CALLBACK,
      ],
    },
    {
      provide: FileUploadServiceAbstraction,
      useClass: FileUploadService,
      deps: [LogService, ApiServiceAbstraction],
    },
    {
      provide: SyncServiceAbstraction,
      useClass: SyncService,
      deps: [
        ApiServiceAbstraction,
        SettingsServiceAbstraction,
        FolderServiceAbstraction,
        CipherServiceAbstraction,
        CryptoServiceAbstraction,
        CollectionServiceAbstraction,
        MessagingServiceAbstraction,
        PolicyServiceAbstraction,
        SendServiceAbstraction,
        LogService,
        KeyConnectorServiceAbstraction,
        StateServiceAbstraction,
        OrganizationServiceAbstraction,
        ProviderServiceAbstraction,
        FolderApiServiceAbstraction,
        LOGOUT_CALLBACK,
      ],
    },
    { provide: BroadcasterServiceAbstraction, useClass: BroadcasterService },
    {
      provide: SettingsServiceAbstraction,
      useClass: SettingsService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: VaultTimeoutServiceAbstraction,
      useClass: VaultTimeoutService,
      deps: [
        CipherServiceAbstraction,
        FolderServiceAbstraction,
        CollectionServiceAbstraction,
        CryptoServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        MessagingServiceAbstraction,
        SearchServiceAbstraction,
        TokenServiceAbstraction,
        PolicyServiceAbstraction,
        KeyConnectorServiceAbstraction,
        StateServiceAbstraction,
        AuthServiceAbstraction,
        LOCKED_CALLBACK,
        LOGOUT_CALLBACK,
      ],
    },
    {
      provide: StateServiceAbstraction,
      useClass: StateService,
      deps: [
        AbstractStorageService,
        SECURE_STORAGE,
        MEMORY_STORAGE,
        LogService,
        StateMigrationServiceAbstraction,
        STATE_FACTORY,
        STATE_SERVICE_USE_CACHE,
      ],
    },
    {
      provide: StateMigrationServiceAbstraction,
      useClass: StateMigrationService,
      deps: [AbstractStorageService, SECURE_STORAGE, STATE_FACTORY],
    },
    {
      provide: ExportServiceAbstraction,
      useClass: ExportService,
      deps: [
        FolderServiceAbstraction,
        CipherServiceAbstraction,
        ApiServiceAbstraction,
        CryptoServiceAbstraction,
      ],
    },
    {
      provide: SearchServiceAbstraction,
      useClass: SearchService,
      deps: [CipherServiceAbstraction, LogService, I18nServiceAbstraction],
    },
    {
      provide: NotificationsServiceAbstraction,
      useClass: NotificationsService,
      deps: [
        SyncServiceAbstraction,
        AppIdServiceAbstraction,
        ApiServiceAbstraction,
        EnvironmentServiceAbstraction,
        LOGOUT_CALLBACK,
        LogService,
        StateServiceAbstraction,
        AuthServiceAbstraction,
      ],
    },
    {
      provide: CryptoFunctionServiceAbstraction,
      useClass: WebCryptoFunctionService,
      deps: [WINDOW],
    },
    {
      provide: AbstractEncryptService,
      useClass: EncryptService,
      deps: [CryptoFunctionServiceAbstraction, LogService, LOG_MAC_FAILURES],
    },
    {
      provide: EventServiceAbstraction,
      useClass: EventService,
      deps: [
        ApiServiceAbstraction,
        CipherServiceAbstraction,
        StateServiceAbstraction,
        LogService,
        OrganizationServiceAbstraction,
      ],
    },
    {
      provide: PolicyServiceAbstraction,
      useClass: PolicyService,
      deps: [StateServiceAbstraction, OrganizationServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: SendServiceAbstraction,
      useClass: SendService,
      deps: [
        CryptoServiceAbstraction,
        ApiServiceAbstraction,
        FileUploadServiceAbstraction,
        I18nServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        StateServiceAbstraction,
      ],
    },
    {
      provide: KeyConnectorServiceAbstraction,
      useClass: KeyConnectorService,
      deps: [
        StateServiceAbstraction,
        CryptoServiceAbstraction,
        ApiServiceAbstraction,
        TokenServiceAbstraction,
        LogService,
        OrganizationServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        LOGOUT_CALLBACK,
      ],
    },
    {
      provide: UserVerificationServiceAbstraction,
      useClass: UserVerificationService,
      deps: [CryptoServiceAbstraction, I18nServiceAbstraction, ApiServiceAbstraction],
    },
    { provide: PasswordRepromptServiceAbstraction, useClass: PasswordRepromptService },
    {
      provide: OrganizationServiceAbstraction,
      useClass: OrganizationService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: ProviderServiceAbstraction,
      useClass: ProviderService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: ProviderApiServiceAbstraction,
      useClass: ProviderApiService,
      deps: [ApiServiceAbstraction],
    },
    {
      provide: TwoFactorServiceAbstraction,
      useClass: TwoFactorService,
      deps: [I18nServiceAbstraction, PlatformUtilsServiceAbstraction],
    },
    {
      provide: AbstractThemingService,
      useClass: ThemingService,
    },
    {
      provide: FormValidationErrorsServiceAbstraction,
      useClass: FormValidationErrorsService,
    },
  ],
})
export class JslibServicesModule {}
