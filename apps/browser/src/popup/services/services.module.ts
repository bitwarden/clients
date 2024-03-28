import { APP_INITIALIZER, NgModule, NgZone } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { ToastrService } from "ngx-toastr";

import { UnauthGuard as BaseUnauthGuardService } from "@bitwarden/angular/auth/guards";
import { AngularThemingService } from "@bitwarden/angular/platform/services/theming/angular-theming.service";
import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import {
  MEMORY_STORAGE,
  SECURE_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  SYSTEM_THEME_OBSERVABLE,
  SafeInjectionToken,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import {
  AuthRequestServiceAbstraction,
  LoginStrategyServiceAbstraction,
} from "@bitwarden/auth/common";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
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
  DefaultDomainSettingsService,
  DomainSettingsService,
} from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  UserNotificationSettingsService,
  UserNotificationSettingsServiceAbstraction,
} from "@bitwarden/common/autofill/services/user-notification-settings.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
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
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { FolderService as FolderServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { DialogService } from "@bitwarden/components";
import { VaultExportServiceAbstraction } from "@bitwarden/vault-export-core";

import { UnauthGuardService } from "../../auth/popup/services";
import { AutofillService } from "../../autofill/services/abstractions/autofill.service";
import MainBackground from "../../background/main.background";
import { Account } from "../../models/account";
import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";
import { BrowserFileDownloadService } from "../../platform/popup/services/browser-file-download.service";
import { BrowserStateService as StateServiceAbstraction } from "../../platform/services/abstractions/browser-state.service";
import { BrowserEnvironmentService } from "../../platform/services/browser-environment.service";
import BrowserLocalStorageService from "../../platform/services/browser-local-storage.service";
import BrowserMessagingPrivateModePopupService from "../../platform/services/browser-messaging-private-mode-popup.service";
import BrowserMessagingService from "../../platform/services/browser-messaging.service";
import { BrowserStateService } from "../../platform/services/browser-state.service";
import I18nService from "../../platform/services/i18n.service";
import { ForegroundPlatformUtilsService } from "../../platform/services/platform-utils/foreground-platform-utils.service";
import { ForegroundDerivedStateProvider } from "../../platform/state/foreground-derived-state.provider";
import { ForegroundMemoryStorageService } from "../../platform/storage/foreground-memory-storage.service";
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

/**
 * Provider definitions used in the ngModule.
 * Add your provider definition here using the safeProvider function as a wrapper. This will give you type safety.
 * If you need help please ask for it, do NOT change the type of this array.
 */
const safeProviders: SafeProvider[] = [
  safeProvider(InitService),
  safeProvider(DebounceNavigationService),
  safeProvider(DialogService),
  safeProvider(PopupCloseWarningService),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => Promise<void>>,
    useFactory: (initService: InitService) => initService.init(),
    deps: [InitService],
    multi: true,
  }),
  safeProvider({
    provide: BaseUnauthGuardService,
    useClass: UnauthGuardService,
    deps: [AuthServiceAbstraction, Router],
  }),
  safeProvider({
    provide: MessagingService,
    useFactory: () => {
      return needsBackgroundInit
        ? new BrowserMessagingPrivateModePopupService()
        : new BrowserMessagingService();
    },
    deps: [],
  }),
  safeProvider({
    provide: TwoFactorService,
    useFactory: getBgService<TwoFactorService>("twoFactorService"),
    deps: [],
  }),
  safeProvider({
    provide: AuthServiceAbstraction,
    useFactory: getBgService<AuthService>("authService"),
    deps: [],
  }),
  safeProvider({
    provide: LoginStrategyServiceAbstraction,
    useFactory: getBgService<LoginStrategyServiceAbstraction>("loginStrategyService"),
    deps: [],
  }),
  safeProvider({
    provide: SsoLoginServiceAbstraction,
    useFactory: getBgService<SsoLoginServiceAbstraction>("ssoLoginService"),
    deps: [],
  }),
  safeProvider({
    provide: SearchServiceAbstraction,
    useFactory: (logService: LogService, i18nService: I18nServiceAbstraction) => {
      return new PopupSearchService(
        getBgService<SearchService>("searchService")(),
        logService,
        i18nService,
      );
    },
    deps: [LogService, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: CipherFileUploadService,
    useFactory: getBgService<CipherFileUploadService>("cipherFileUploadService"),
    deps: [],
  }),
  safeProvider({
    provide: CipherService,
    useFactory: getBgService<CipherService>("cipherService"),
    deps: [],
  }),
  safeProvider({
    provide: CryptoFunctionService,
    useFactory: () => new WebCryptoFunctionService(window),
    deps: [],
  }),
  safeProvider({
    provide: CollectionService,
    useFactory: getBgService<CollectionService>("collectionService"),
    deps: [],
  }),
  safeProvider({
    provide: LogService,
    useFactory: (platformUtilsService: PlatformUtilsService) =>
      new ConsoleLogService(platformUtilsService.isDev()),
    deps: [PlatformUtilsService],
  }),
  safeProvider({
    provide: EnvironmentService,
    useExisting: BrowserEnvironmentService,
  }),
  safeProvider({
    provide: BrowserEnvironmentService,
    useClass: BrowserEnvironmentService,
    deps: [LogService, StateProvider, AccountServiceAbstraction],
  }),
  safeProvider({
    provide: TotpService,
    useFactory: getBgService<TotpService>("totpService"),
    deps: [],
  }),
  safeProvider({
    provide: I18nServiceAbstraction,
    useFactory: (globalStateProvider: GlobalStateProvider) => {
      return new I18nService(BrowserApi.getUILanguage(), globalStateProvider);
    },
    deps: [GlobalStateProvider],
  }),
  safeProvider({
    provide: CryptoService,
    useFactory: (encryptService: EncryptService) => {
      const cryptoService = getBgService<CryptoService>("cryptoService")();
      new ContainerService(cryptoService, encryptService).attachToGlobal(self);
      return cryptoService;
    },
    deps: [EncryptService],
  }),
  safeProvider({
    provide: AuthRequestServiceAbstraction,
    useFactory: getBgService<AuthRequestServiceAbstraction>("authRequestService"),
    deps: [],
  }),
  safeProvider({
    provide: DeviceTrustCryptoServiceAbstraction,
    useFactory: getBgService<DeviceTrustCryptoServiceAbstraction>("deviceTrustCryptoService"),
    deps: [],
  }),
  safeProvider({
    provide: DevicesServiceAbstraction,
    useFactory: getBgService<DevicesServiceAbstraction>("devicesService"),
    deps: [],
  }),
  safeProvider({
    provide: PlatformUtilsService,
    useExisting: ForegroundPlatformUtilsService,
  }),
  safeProvider({
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
  }),
  safeProvider({
    provide: PasswordGenerationServiceAbstraction,
    useFactory: getBgService<PasswordGenerationServiceAbstraction>("passwordGenerationService"),
    deps: [],
  }),
  safeProvider({
    provide: SyncService,
    useFactory: getBgService<SyncService>("syncService"),
    deps: [],
  }),
  safeProvider({
    provide: DomainSettingsService,
    useClass: DefaultDomainSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: AbstractStorageService,
    useClass: BrowserLocalStorageService,
    deps: [],
  }),
  safeProvider({
    provide: AutofillService,
    useFactory: getBgService<AutofillService>("autofillService"),
    deps: [],
  }),
  safeProvider({
    provide: VaultExportServiceAbstraction,
    useFactory: getBgService<VaultExportServiceAbstraction>("exportService"),
    deps: [],
  }),
  safeProvider({
    provide: KeyConnectorService,
    useFactory: getBgService<KeyConnectorService>("keyConnectorService"),
    deps: [],
  }),
  safeProvider({
    provide: UserVerificationService,
    useFactory: getBgService<UserVerificationService>("userVerificationService"),
    deps: [],
  }),
  safeProvider({
    provide: VaultTimeoutSettingsService,
    useFactory: getBgService<VaultTimeoutSettingsService>("vaultTimeoutSettingsService"),
    deps: [],
  }),
  safeProvider({
    provide: VaultTimeoutService,
    useFactory: getBgService<VaultTimeoutService>("vaultTimeoutService"),
    deps: [],
  }),
  safeProvider({
    provide: NotificationsService,
    useFactory: getBgService<NotificationsService>("notificationsService"),
    deps: [],
  }),
  safeProvider({
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
  }),
  safeProvider({
    provide: SECURE_STORAGE,
    useExisting: AbstractStorageService, // Secure storage is not available in the browser, so we use normal storage instead and warn users when it is used.
  }),
  safeProvider({
    provide: MEMORY_STORAGE,
    useFactory: getBgService<AbstractStorageService>("memoryStorageService"),
    deps: [],
  }),
  safeProvider({
    provide: OBSERVABLE_MEMORY_STORAGE,
    useClass: ForegroundMemoryStorageService,
    deps: [],
  }),
  safeProvider({
    provide: OBSERVABLE_DISK_STORAGE,
    useExisting: AbstractStorageService,
  }),
  safeProvider({
    provide: StateServiceAbstraction,
    useFactory: (
      storageService: AbstractStorageService,
      secureStorageService: AbstractStorageService,
      memoryStorageService: AbstractMemoryStorageService,
      logService: LogService,
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
      LogService,
      AccountServiceAbstraction,
      EnvironmentService,
      TokenService,
      MigrationRunner,
    ],
  }),
  safeProvider({
    provide: UsernameGenerationServiceAbstraction,
    useFactory: getBgService<UsernameGenerationServiceAbstraction>("usernameGenerationService"),
    deps: [],
  }),
  safeProvider({
    provide: BaseStateServiceAbstraction,
    useExisting: StateServiceAbstraction,
    deps: [],
  }),
  safeProvider({
    provide: FileDownloadService,
    useClass: BrowserFileDownloadService,
    deps: [],
  }),
  safeProvider({
    provide: LoginServiceAbstraction,
    useClass: LoginService,
    deps: [StateServiceAbstraction],
  }),
  safeProvider({
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
  }),
  safeProvider({
    provide: FilePopoutUtilsService,
    useFactory: (platformUtilsService: PlatformUtilsService) => {
      return new FilePopoutUtilsService(platformUtilsService);
    },
    deps: [PlatformUtilsService],
  }),
  safeProvider({
    provide: DerivedStateProvider,
    useClass: ForegroundDerivedStateProvider,
    deps: [OBSERVABLE_MEMORY_STORAGE, NgZone],
  }),
  safeProvider({
    provide: AutofillSettingsServiceAbstraction,
    useClass: AutofillSettingsService,
    deps: [StateProvider, PolicyService],
  }),
  safeProvider({
    provide: UserNotificationSettingsServiceAbstraction,
    useClass: UserNotificationSettingsService,
    deps: [StateProvider],
  }),
];

@NgModule({
  imports: [JslibServicesModule],
  declarations: [],
  // Do not register your dependency here! Add it to the typesafeProviders array using the helper function
  providers: safeProviders,
})
export class ServicesModule {}
