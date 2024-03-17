import { APP_INITIALIZER, NgModule, NgZone } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { ToastrService } from "ngx-toastr";

import { UnauthGuard as BaseUnauthGuardService } from "@bitwarden/angular/auth/guards";
import { AngularThemingService } from "@bitwarden/angular/platform/services/theming/angular-theming.service";
import {
  MEMORY_STORAGE,
  SECURE_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  SYSTEM_THEME_OBSERVABLE,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import {
  AuthRequestServiceAbstraction,
  LoginStrategyServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventUploadService } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService as AccountServiceAbstraction } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { LoginService as LoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/login.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { LoginService } from "@bitwarden/common/auth/services/login.service";
import {
  AutofillSettingsService,
  AutofillSettingsServiceAbstraction,
} from "@bitwarden/common/autofill/services/autofill-settings.service";
import {
  UserNotificationSettingsService,
  UserNotificationSettingsServiceAbstraction,
} from "@bitwarden/common/autofill/services/user-notification-settings.service";
import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { FileUploadService } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import {
  LogService,
  LogService as LogServiceAbstraction,
} from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { WebCryptoFunctionService } from "@bitwarden/common/platform/services/web-crypto-function.service";
import {
  DerivedStateProvider,
  GlobalStateProvider,
  StateProvider,
} from "@bitwarden/common/platform/state";
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
import { FolderService as FolderServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { DialogService } from "@bitwarden/components";
import { ImportServiceAbstraction } from "@bitwarden/importer/core";
import { VaultExportServiceAbstraction } from "@bitwarden/vault-export-core";

import { BrowserOrganizationService } from "../../admin-console/services/browser-organization.service";
import { UnauthGuardService } from "../../auth/popup/services";
import { AutofillService } from "../../autofill/services/abstractions/autofill.service";
import MainBackground from "../../background/main.background";
import { Account } from "../../models/account";
import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";
import { BrowserStateService as StateServiceAbstraction } from "../../platform/services/abstractions/browser-state.service";
import { BrowserConfigService } from "../../platform/services/browser-config.service";
import { BrowserEnvironmentService } from "../../platform/services/browser-environment.service";
import { BrowserFileDownloadService } from "../../platform/services/browser-file-download.service";
import BrowserLocalStorageService from "../../platform/services/browser-local-storage.service";
import BrowserMessagingPrivateModePopupService from "../../platform/services/browser-messaging-private-mode-popup.service";
import BrowserMessagingService from "../../platform/services/browser-messaging.service";
import { BrowserStateService } from "../../platform/services/browser-state.service";
import I18nService from "../../platform/services/i18n.service";
import { ForegroundPlatformUtilsService } from "../../platform/services/platform-utils/foreground-platform-utils.service";
import { ForegroundDerivedStateProvider } from "../../platform/state/foreground-derived-state.provider";
import { ForegroundMemoryStorageService } from "../../platform/storage/foreground-memory-storage.service";
import { BrowserSendService } from "../../services/browser-send.service";
import { BrowserSettingsService } from "../../services/browser-settings.service";
import { FilePopoutUtilsService } from "../../tools/popup/services/file-popout-utils.service";
import { VaultFilterService } from "../../vault/services/vault-filter.service";

import { DebounceNavigationService } from "./debounce-navigation.service";
import { InitService } from "./init.service";
import { PopupCloseWarningService } from "./popup-close-warning.service";
import { PopupSearchService } from "./popup-search.service";

const needsBackgroundInit = BrowserPopupUtils.backgroundInitializationRequired();
const isPrivateMode = BrowserPopupUtils.inPrivateMode();
const mainBackground: MainBackground = needsBackgroundInit
  ? createLocalBgService()
  : BrowserApi.getBackgroundPage().bitwardenMain;

function createLocalBgService() {
  const localBgService = new MainBackground(isPrivateMode);
  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  localBgService.bootstrap();
  return localBgService;
}

/** @deprecated This method needs to be removed as part of MV3 conversion. Please do not add more and actively try to remove usages */
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
    PopupCloseWarningService,
    {
      provide: APP_INITIALIZER,
      useFactory: (initService: InitService) => initService.init(),
      deps: [InitService],
      multi: true,
    },
    { provide: BaseUnauthGuardService, useClass: UnauthGuardService },
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
      provide: LoginStrategyServiceAbstraction,
      useFactory: getBgService<LoginStrategyServiceAbstraction>("loginStrategyService"),
    },
    {
      provide: SsoLoginServiceAbstraction,
      useFactory: getBgService<SsoLoginServiceAbstraction>("ssoLoginService"),
      deps: [],
    },
    {
      provide: SearchServiceAbstraction,
      useFactory: (logService: ConsoleLogService, i18nService: I18nServiceAbstraction) => {
        return new PopupSearchService(
          getBgService<SearchService>("searchService")(),
          logService,
          i18nService,
        );
      },
      deps: [LogServiceAbstraction, I18nServiceAbstraction],
    },
    {
      provide: CipherFileUploadService,
      useFactory: getBgService<CipherFileUploadService>("cipherFileUploadService"),
      deps: [],
    },
    { provide: CipherService, useFactory: getBgService<CipherService>("cipherService"), deps: [] },
    {
      provide: CryptoFunctionService,
      useFactory: () => new WebCryptoFunctionService(window),
      deps: [],
    },
    {
      provide: CollectionService,
      useFactory: getBgService<CollectionService>("collectionService"),
      deps: [],
    },
    {
      provide: LogServiceAbstraction,
      useFactory: (platformUtilsService: PlatformUtilsService) =>
        new ConsoleLogService(platformUtilsService.isDev()),
      deps: [PlatformUtilsService],
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
    {
      provide: I18nServiceAbstraction,
      useFactory: (globalStateProvider: GlobalStateProvider) => {
        return new I18nService(BrowserApi.getUILanguage(), globalStateProvider);
      },
      deps: [GlobalStateProvider],
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
      provide: AuthRequestServiceAbstraction,
      useFactory: getBgService<AuthRequestServiceAbstraction>("authRequestService"),
      deps: [],
    },
    {
      provide: DeviceTrustCryptoServiceAbstraction,
      useFactory: getBgService<DeviceTrustCryptoServiceAbstraction>("deviceTrustCryptoService"),
      deps: [],
    },
    {
      provide: DevicesServiceAbstraction,
      useFactory: getBgService<DevicesServiceAbstraction>("devicesService"),
      deps: [],
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
      provide: PlatformUtilsService,
      useExisting: ForegroundPlatformUtilsService,
    },
    {
      provide: ForegroundPlatformUtilsService,
      useClass: ForegroundPlatformUtilsService,
      useFactory: (sanitizer: DomSanitizer, toastrService: ToastrService) => {
        return new ForegroundPlatformUtilsService(
          sanitizer,
          toastrService,
          (clipboardValue: string, clearMs: number) => {
            void BrowserApi.sendMessage("clearClipboard", { clipboardValue, clearMs });
          },
          async () => {
            const response = await BrowserApi.sendMessageWithResponse<{
              result: boolean;
              error: string;
            }>("biometricUnlock");
            if (!response.result) {
              throw response.error;
            }
            return response.result;
          },
          window,
        );
      },
      deps: [DomSanitizer, ToastrService],
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
    {
      provide: SendService,
      useFactory: (
        cryptoService: CryptoService,
        i18nService: I18nServiceAbstraction,
        keyGenerationService: KeyGenerationService,
        stateServiceAbstraction: StateServiceAbstraction,
      ) => {
        return new BrowserSendService(
          cryptoService,
          i18nService,
          keyGenerationService,
          stateServiceAbstraction,
        );
      },
      deps: [CryptoService, I18nServiceAbstraction, KeyGenerationService, StateServiceAbstraction],
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
        sendService: InternalSendServiceAbstraction,
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
      useClass: BrowserLocalStorageService,
      deps: [],
    },
    {
      provide: AutofillService,
      useFactory: getBgService<AutofillService>("autofillService"),
      deps: [],
    },
    {
      provide: ImportServiceAbstraction,
      useFactory: getBgService<ImportServiceAbstraction>("importService"),
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
      provide: OrganizationService,
      useFactory: (stateService: StateServiceAbstraction, stateProvider: StateProvider) => {
        return new BrowserOrganizationService(stateService, stateProvider);
      },
      deps: [StateServiceAbstraction, StateProvider],
    },
    {
      provide: VaultFilterService,
      useClass: VaultFilterService,
      deps: [
        OrganizationService,
        FolderServiceAbstraction,
        CipherService,
        CollectionService,
        PolicyService,
        StateProvider,
        AccountServiceAbstraction,
      ],
    },
    {
      provide: SECURE_STORAGE,
      useExisting: AbstractStorageService, // Secure storage is not available in the browser, so we use normal storage instead and warn users when it is used.
    },
    {
      provide: MEMORY_STORAGE,
      useFactory: getBgService<AbstractStorageService>("memoryStorageService"),
    },
    {
      provide: OBSERVABLE_MEMORY_STORAGE,
      useClass: ForegroundMemoryStorageService,
      deps: [],
    },
    {
      provide: OBSERVABLE_DISK_STORAGE,
      useExisting: AbstractStorageService,
    },
    {
      provide: StateServiceAbstraction,
      useFactory: (
        storageService: AbstractStorageService,
        secureStorageService: AbstractStorageService,
        memoryStorageService: AbstractMemoryStorageService,
        logService: LogServiceAbstraction,
        accountService: AccountServiceAbstraction,
        environmentService: EnvironmentService,
        tokenService: TokenService,
        migrationRunner: MigrationRunner,
      ) => {
        return new BrowserStateService(
          storageService,
          secureStorageService,
          memoryStorageService,
          logService,
          new StateFactory(GlobalState, Account),
          accountService,
          environmentService,
          tokenService,
          migrationRunner,
        );
      },
      deps: [
        AbstractStorageService,
        SECURE_STORAGE,
        MEMORY_STORAGE,
        LogServiceAbstraction,
        AccountServiceAbstraction,
        EnvironmentService,
        TokenService,
        MigrationRunner,
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
      provide: SYSTEM_THEME_OBSERVABLE,
      useFactory: (platformUtilsService: PlatformUtilsService) => {
        // Safari doesn't properly handle the (prefers-color-scheme) media query in the popup window, it always returns light.
        // In Safari, we have to use the background page instead, which comes with limitations like not dynamically changing the extension theme when the system theme is changed.
        let windowContext = window;
        const backgroundWindow = BrowserApi.getBackgroundPage();
        if (platformUtilsService.isSafari() && backgroundWindow) {
          windowContext = backgroundWindow;
        }

        return AngularThemingService.createSystemThemeFromWindow(windowContext);
      },
      deps: [PlatformUtilsService],
    },
    {
      provide: ConfigService,
      useClass: BrowserConfigService,
      deps: [
        StateServiceAbstraction,
        ConfigApiServiceAbstraction,
        AuthServiceAbstraction,
        EnvironmentService,
        LogService,
      ],
    },
    {
      provide: FilePopoutUtilsService,
      useFactory: (platformUtilsService: PlatformUtilsService) => {
        return new FilePopoutUtilsService(platformUtilsService);
      },
      deps: [PlatformUtilsService],
    },
    {
      provide: DerivedStateProvider,
      useClass: ForegroundDerivedStateProvider,
      deps: [OBSERVABLE_MEMORY_STORAGE, NgZone],
    },
    {
      provide: AutofillSettingsServiceAbstraction,
      useClass: AutofillSettingsService,
      deps: [StateProvider, PolicyService],
    },
    {
      provide: UserNotificationSettingsServiceAbstraction,
      useClass: UserNotificationSettingsService,
      deps: [StateProvider],
    },
  ],
})
export class ServicesModule {}
