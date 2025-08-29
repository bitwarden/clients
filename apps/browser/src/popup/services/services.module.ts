// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { APP_INITIALIZER, NgModule, NgZone } from "@angular/core";
import { merge, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { DeviceManagementComponentServiceAbstraction } from "@bitwarden/angular/auth/device-management/device-management-component.service.abstraction";
import { ChangePasswordService } from "@bitwarden/angular/auth/password-management/change-password";
import { AngularThemingService } from "@bitwarden/angular/platform/services/theming/angular-theming.service";
import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import {
  CLIENT_TYPE,
  DEFAULT_VAULT_TIMEOUT,
  ENV_ADDITIONAL_REGIONS,
  INTRAPROCESS_MESSAGING_SUBJECT,
  MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  SafeInjectionToken,
  SECURE_STORAGE,
  SYSTEM_THEME_OBSERVABLE,
  WINDOW,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import {
  LoginComponentService,
  TwoFactorAuthComponentService,
  TwoFactorAuthDuoComponentService,
  TwoFactorAuthWebAuthnComponentService,
  SsoComponentService,
} from "@bitwarden/auth/angular";
import {
  LockService,
  LoginEmailService,
  SsoUrlService,
  LogoutService,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService as EventCollectionServiceAbstraction } from "@bitwarden/common/abstractions/event/event-collection.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  AccountService,
  AccountService as AccountServiceAbstraction,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
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
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ClientType } from "@bitwarden/common/enums";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { WebCryptoFunctionService } from "@bitwarden/common/key-management/crypto/services/web-crypto-function.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeoutService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import {
  AnimationControlService,
  DefaultAnimationControlService,
} from "@bitwarden/common/platform/abstractions/animation-control.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import {
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import { Message, MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- Used for dependency injection
import { SubjectMessageSender } from "@bitwarden/common/platform/messaging/internal";
import { flagEnabled } from "@bitwarden/common/platform/misc/flags";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { DefaultSdkClientFactory } from "@bitwarden/common/platform/services/sdk/default-sdk-client-factory";
import { NoopSdkClientFactory } from "@bitwarden/common/platform/services/sdk/noop-sdk-client-factory";
import { StorageServiceProvider } from "@bitwarden/common/platform/services/storage-service.provider";
import { PrimarySecondaryStorageService } from "@bitwarden/common/platform/storage/primary-secondary-storage.service";
import { WindowStorageService } from "@bitwarden/common/platform/storage/window-storage.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { SystemNotificationsService } from "@bitwarden/common/platform/system-notifications/system-notifications.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/vault/abstractions/totp.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { TotpService } from "@bitwarden/common/vault/services/totp.service";
import {
  AnonLayoutWrapperDataService,
  CompactModeService,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import {
  BiometricsService,
  DefaultKeyService,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
import { LockComponentService } from "@bitwarden/key-management-ui";
import { DerivedStateProvider, GlobalStateProvider, StateProvider } from "@bitwarden/state";
import { InlineDerivedStateProvider } from "@bitwarden/state-internal";
import {
  DefaultSshImportPromptService,
  PasswordRepromptService,
  SshImportPromptService,
} from "@bitwarden/vault";

import { AccountSwitcherService } from "../../auth/popup/account-switching/services/account-switcher.service";
import { ForegroundLockService } from "../../auth/popup/accounts/foreground-lock.service";
import { ExtensionChangePasswordService } from "../../auth/popup/change-password/extension-change-password.service";
import { ExtensionLoginComponentService } from "../../auth/popup/login/extension-login-component.service";
import { ExtensionSsoComponentService } from "../../auth/popup/login/extension-sso-component.service";
import { ExtensionLogoutService } from "../../auth/popup/logout/extension-logout.service";
import { ExtensionDeviceManagementComponentService } from "../../auth/services/extension-device-management-component.service";
import { ExtensionTwoFactorAuthComponentService } from "../../auth/services/extension-two-factor-auth-component.service";
import { ExtensionTwoFactorAuthDuoComponentService } from "../../auth/services/extension-two-factor-auth-duo-component.service";
import { ExtensionTwoFactorAuthWebAuthnComponentService } from "../../auth/services/extension-two-factor-auth-webauthn-component.service";
import { AutofillService as AutofillServiceAbstraction } from "../../autofill/services/abstractions/autofill.service";
import AutofillService from "../../autofill/services/autofill.service";
import { InlineMenuFieldQualificationService } from "../../autofill/services/inline-menu-field-qualification.service";
import { ForegroundBrowserBiometricsService } from "../../key-management/biometrics/foreground-browser-biometrics";
import { ExtensionLockComponentService } from "../../key-management/lock/services/extension-lock-component.service";
import { ForegroundVaultTimeoutService } from "../../key-management/vault-timeout/foreground-vault-timeout.service";
import { BrowserActionsService } from "../../platform/actions/browser-actions.service";
import { BrowserApi } from "../../platform/browser/browser-api";
import { runInsideAngular } from "../../platform/browser/run-inside-angular.operator";
/* eslint-disable no-restricted-imports */
import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";
import { ChromeMessageSender } from "../../platform/messaging/chrome-message.sender";
/* eslint-enable no-restricted-imports */
import { ForegroundServerNotificationsService } from "../../platform/notifications/foreground-server-notifications.service";
import { OffscreenDocumentService } from "../../platform/offscreen-document/abstractions/offscreen-document";
import { DefaultOffscreenDocumentService } from "../../platform/offscreen-document/offscreen-document.service";
import { PopupCompactModeService } from "../../platform/popup/layout/popup-compact-mode.service";
import { BrowserFileDownloadService } from "../../platform/popup/services/browser-file-download.service";
import { PopupViewCacheService } from "../../platform/popup/view-cache/popup-view-cache.service";
import { ScriptInjectorService } from "../../platform/services/abstractions/script-injector.service";
import { BrowserEnvironmentService } from "../../platform/services/browser-environment.service";
import BrowserLocalStorageService from "../../platform/services/browser-local-storage.service";
import BrowserMemoryStorageService from "../../platform/services/browser-memory-storage.service";
import { BrowserScriptInjectorService } from "../../platform/services/browser-script-injector.service";
import I18nService from "../../platform/services/i18n.service";
import { ForegroundPlatformUtilsService } from "../../platform/services/platform-utils/foreground-platform-utils.service";
import { BrowserSdkLoadService } from "../../platform/services/sdk/browser-sdk-load.service";
import { ForegroundTaskSchedulerService } from "../../platform/services/task-scheduler/foreground-task-scheduler.service";
import { BrowserStorageServiceProvider } from "../../platform/storage/browser-storage-service.provider";
import { ForegroundMemoryStorageService } from "../../platform/storage/foreground-memory-storage.service";
import { ForegroundSyncService } from "../../platform/sync/foreground-sync.service";
import { BrowserSystemNotificationService } from "../../platform/system-notifications/browser-system-notification.service";
import { fromChromeRuntimeMessaging } from "../../platform/utils/from-chrome-runtime-messaging";
import { FilePopoutUtilsService } from "../../tools/popup/services/file-popout-utils.service";
import { Fido2UserVerificationService } from "../../vault/services/fido2-user-verification.service";
import { ExtensionAnonLayoutWrapperDataService } from "../components/extension-anon-layout-wrapper/extension-anon-layout-wrapper-data.service";

import { DebounceNavigationService } from "./debounce-navigation.service";
import { InitService } from "./init.service";
import { PopupCloseWarningService } from "./popup-close-warning.service";

const OBSERVABLE_LARGE_OBJECT_MEMORY_STORAGE = new SafeInjectionToken<
  AbstractStorageService & ObservableStorageService
>("OBSERVABLE_LARGE_OBJECT_MEMORY_STORAGE");

const DISK_BACKUP_LOCAL_STORAGE = new SafeInjectionToken<
  AbstractStorageService & ObservableStorageService
>("DISK_BACKUP_LOCAL_STORAGE");

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
  safeProvider(InlineMenuFieldQualificationService),
  safeProvider({
    provide: DEFAULT_VAULT_TIMEOUT,
    useValue: VaultTimeoutStringType.OnRestart,
  }),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => Promise<void>>,
    useFactory: (initService: InitService) => initService.init(),
    deps: [InitService],
    multi: true,
  }),
  safeProvider({
    provide: CryptoFunctionService,
    useFactory: () => new WebCryptoFunctionService(window),
    deps: [],
  }),
  safeProvider({
    provide: LogService,
    useFactory: () => {
      const isDev = process.env.ENV === "development";
      return new ConsoleLogService(isDev);
    },
    deps: [],
  }),
  safeProvider({
    provide: EnvironmentService,
    useExisting: BrowserEnvironmentService,
  }),
  safeProvider({
    provide: BrowserEnvironmentService,
    useClass: BrowserEnvironmentService,
    deps: [LogService, StateProvider, AccountServiceAbstraction, ENV_ADDITIONAL_REGIONS],
  }),
  safeProvider({
    provide: I18nServiceAbstraction,
    useFactory: (globalStateProvider: GlobalStateProvider) => {
      return new I18nService(BrowserApi.getUILanguage(), globalStateProvider);
    },
    deps: [GlobalStateProvider],
  }),
  safeProvider({
    provide: ActionsService,
    useClass: BrowserActionsService,
    deps: [LogService, PlatformUtilsService],
  }),
  safeProvider({
    provide: KeyService,
    useFactory: (
      pinService: PinServiceAbstraction,
      masterPasswordService: InternalMasterPasswordServiceAbstraction,
      keyGenerationService: KeyGenerationService,
      cryptoFunctionService: CryptoFunctionService,
      encryptService: EncryptService,
      platformUtilsService: PlatformUtilsService,
      logService: LogService,
      stateService: StateService,
      accountService: AccountServiceAbstraction,
      stateProvider: StateProvider,
      kdfConfigService: KdfConfigService,
    ) => {
      const keyService = new DefaultKeyService(
        pinService,
        masterPasswordService,
        keyGenerationService,
        cryptoFunctionService,
        encryptService,
        platformUtilsService,
        logService,
        stateService,
        accountService,
        stateProvider,
        kdfConfigService,
      );
      new ContainerService(keyService, encryptService).attachToGlobal(self);
      return keyService;
    },
    deps: [
      PinServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      KeyGenerationService,
      CryptoFunctionService,
      EncryptService,
      PlatformUtilsService,
      LogService,
      StateService,
      AccountServiceAbstraction,
      StateProvider,
      KdfConfigService,
    ],
  }),
  safeProvider({
    provide: TotpServiceAbstraction,
    useClass: TotpService,
    deps: [SdkService],
  }),
  safeProvider({
    provide: OffscreenDocumentService,
    useClass: DefaultOffscreenDocumentService,
    deps: [LogService],
  }),
  safeProvider({
    provide: PlatformUtilsService,
    useFactory: (
      toastService: ToastService,
      offscreenDocumentService: OffscreenDocumentService,
    ) => {
      return new ForegroundPlatformUtilsService(
        toastService,
        (clipboardValue: string, clearMs: number) => {
          void BrowserApi.sendMessage("clearClipboard", { clipboardValue, clearMs });
        },
        window,
        offscreenDocumentService,
      );
    },
    deps: [ToastService, OffscreenDocumentService],
  }),
  safeProvider({
    provide: BiometricsService,
    useClass: ForegroundBrowserBiometricsService,
    deps: [PlatformUtilsService],
  }),
  safeProvider({
    provide: SyncService,
    useClass: ForegroundSyncService,
    deps: [
      TokenService,
      InternalFolderService,
      FolderApiServiceAbstraction,
      MessageSender,
      LogService,
      CipherService,
      CollectionService,
      ApiService,
      AccountServiceAbstraction,
      AuthService,
      InternalSendService,
      SendApiService,
      MessageListener,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: DomainSettingsService,
    useClass: DefaultDomainSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: AbstractStorageService,
    useClass: BrowserLocalStorageService,
    deps: [LogService],
  }),
  safeProvider({
    provide: AutofillServiceAbstraction,
    useExisting: AutofillService,
  }),
  safeProvider({
    provide: ViewCacheService,
    useExisting: PopupViewCacheService,
    deps: [],
  }),
  safeProvider({
    provide: AutofillService,
    deps: [
      CipherService,
      AutofillSettingsServiceAbstraction,
      TotpServiceAbstraction,
      EventCollectionServiceAbstraction,
      LogService,
      DomainSettingsService,
      UserVerificationService,
      BillingAccountProfileStateService,
      ScriptInjectorService,
      AccountServiceAbstraction,
      AuthService,
      ConfigService,
      UserNotificationSettingsServiceAbstraction,
      MessageListener,
    ],
  }),
  safeProvider({
    provide: ScriptInjectorService,
    useClass: BrowserScriptInjectorService,
    deps: [DomainSettingsService, PlatformUtilsService, LogService],
  }),
  safeProvider({
    provide: VaultTimeoutService,
    useClass: ForegroundVaultTimeoutService,
    deps: [MessagingServiceAbstraction],
  }),
  safeProvider({
    provide: SECURE_STORAGE,
    useExisting: AbstractStorageService, // Secure storage is not available in the browser, so we use normal storage instead and warn users when it is used.
  }),
  safeProvider({
    provide: MEMORY_STORAGE,
    useFactory: (memoryStorage: AbstractStorageService) => memoryStorage,
    deps: [OBSERVABLE_MEMORY_STORAGE],
  }),
  safeProvider({
    provide: OBSERVABLE_MEMORY_STORAGE,
    useFactory: () => {
      if (BrowserApi.isManifestVersion(2)) {
        return new ForegroundMemoryStorageService();
      }

      return new BrowserMemoryStorageService();
    },
    deps: [],
  }),
  safeProvider({
    provide: OBSERVABLE_LARGE_OBJECT_MEMORY_STORAGE,
    useFactory: (
      regularMemoryStorageService: AbstractStorageService & ObservableStorageService,
    ) => {
      if (BrowserApi.isManifestVersion(2)) {
        return regularMemoryStorageService;
      }

      return new ForegroundMemoryStorageService();
    },
    deps: [OBSERVABLE_MEMORY_STORAGE],
  }),
  safeProvider({
    provide: OBSERVABLE_DISK_STORAGE,
    useExisting: AbstractStorageService,
  }),
  safeProvider({
    provide: FileDownloadService,
    useClass: BrowserFileDownloadService,
    deps: [],
  }),
  safeProvider({
    provide: SYSTEM_THEME_OBSERVABLE,
    useFactory: (platformUtilsService: PlatformUtilsService) => {
      // Safari doesn't properly handle the (prefers-color-scheme) media query in the popup window, it always returns light.
      // This means we have to use the background page instead, which comes with limitations like not dynamically
      // changing the extension theme when the system theme is changed. We also have issues with memory leaks when
      // holding the reference to the background page.
      const backgroundWindow = BrowserApi.getBackgroundPage();
      if (platformUtilsService.isSafari() && backgroundWindow) {
        return of(AngularThemingService.getSystemThemeFromWindow(backgroundWindow));
      } else {
        return AngularThemingService.createSystemThemeFromWindow(window);
      }
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
    useClass: InlineDerivedStateProvider,
    deps: [],
  }),
  safeProvider({
    provide: AutofillSettingsServiceAbstraction,
    useClass: AutofillSettingsService,
    deps: [StateProvider, PolicyService, AccountService, RestrictedItemTypesService],
  }),
  safeProvider({
    provide: UserNotificationSettingsServiceAbstraction,
    useClass: UserNotificationSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: MessageListener,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>, ngZone: NgZone) =>
      new MessageListener(
        merge(
          subject.asObservable(), // For messages in the same context
          fromChromeRuntimeMessaging().pipe(runInsideAngular(ngZone)), // For messages in the same context
        ),
      ),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT, NgZone],
  }),
  safeProvider({
    provide: MessageSender,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>, logService: LogService) =>
      MessageSender.combine(
        new SubjectMessageSender(subject), // For sending messages in the same context
        new ChromeMessageSender(logService), // For sending messages to different contexts
      ),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT, LogService],
  }),
  safeProvider({
    provide: INTRAPROCESS_MESSAGING_SUBJECT,
    useFactory: () => new Subject<Message<Record<string, unknown>>>(),
    deps: [],
  }),
  safeProvider({
    provide: MessageSender,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>, logService: LogService) =>
      MessageSender.combine(
        new SubjectMessageSender(subject), // For sending messages in the same context
        new ChromeMessageSender(logService), // For sending messages to different contexts
      ),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT, LogService],
  }),
  safeProvider({
    provide: DISK_BACKUP_LOCAL_STORAGE,
    useFactory: (diskStorage: AbstractStorageService & ObservableStorageService) =>
      new PrimarySecondaryStorageService(diskStorage, new WindowStorageService(self.localStorage)),
    deps: [OBSERVABLE_DISK_STORAGE],
  }),
  safeProvider({
    provide: StorageServiceProvider,
    useClass: BrowserStorageServiceProvider,
    deps: [
      OBSERVABLE_DISK_STORAGE,
      OBSERVABLE_MEMORY_STORAGE,
      OBSERVABLE_LARGE_OBJECT_MEMORY_STORAGE,
      DISK_BACKUP_LOCAL_STORAGE,
    ],
  }),
  safeProvider({
    provide: CLIENT_TYPE,
    useValue: ClientType.Browser,
  }),
  safeProvider({
    provide: LockComponentService,
    useClass: ExtensionLockComponentService,
    deps: [],
  }),
  // TODO: PM-18182 - Refactor component services into lazy loaded modules
  safeProvider({
    provide: TwoFactorAuthComponentService,
    useClass: ExtensionTwoFactorAuthComponentService,
    deps: [WINDOW],
  }),
  safeProvider({
    provide: TwoFactorAuthWebAuthnComponentService,
    useClass: ExtensionTwoFactorAuthWebAuthnComponentService,
    deps: [],
  }),
  safeProvider({
    provide: TwoFactorAuthDuoComponentService,
    useClass: ExtensionTwoFactorAuthDuoComponentService,
    deps: [
      ZonedMessageListenerService,
      EnvironmentService,
      I18nServiceAbstraction,
      PlatformUtilsService,
    ],
  }),
  safeProvider({
    provide: ActionsService,
    useClass: BrowserActionsService,
    deps: [LogService, PlatformUtilsService],
  }),
  safeProvider({
    provide: SystemNotificationsService,
    useClass: BrowserSystemNotificationService,
    deps: [PlatformUtilsService],
  }),
  safeProvider({
    provide: Fido2UserVerificationService,
    useClass: Fido2UserVerificationService,
    deps: [PasswordRepromptService, UserVerificationService, DialogService],
  }),
  safeProvider({
    provide: AnimationControlService,
    useClass: DefaultAnimationControlService,
    deps: [GlobalStateProvider],
  }),
  safeProvider({
    provide: TaskSchedulerService,
    useExisting: ForegroundTaskSchedulerService,
  }),
  safeProvider({
    provide: ForegroundTaskSchedulerService,
    useClass: ForegroundTaskSchedulerService,
    deps: [LogService, StateProvider],
  }),
  safeProvider({
    provide: AnonLayoutWrapperDataService,
    useExisting: ExtensionAnonLayoutWrapperDataService,
    deps: [],
  }),
  safeProvider({
    provide: SsoUrlService,
    useClass: SsoUrlService,
    deps: [],
  }),
  safeProvider({
    provide: SystemNotificationsService,
    useClass: BrowserSystemNotificationService,
    deps: [PlatformUtilsService],
  }),
  safeProvider({
    provide: LoginComponentService,
    useClass: ExtensionLoginComponentService,
    deps: [
      CryptoFunctionService,
      EnvironmentService,
      PasswordGenerationServiceAbstraction,
      PlatformUtilsService,
      SsoLoginServiceAbstraction,
      ExtensionAnonLayoutWrapperDataService,
      SsoUrlService,
    ],
  }),
  safeProvider({
    provide: LockService,
    useClass: ForegroundLockService,
    deps: [MessageSender, MessageListener],
  }),
  safeProvider({
    provide: SdkLoadService,
    useClass: BrowserSdkLoadService,
    deps: [LogService],
  }),
  safeProvider({
    provide: SdkClientFactory,
    useFactory: () =>
      flagEnabled("sdk") ? new DefaultSdkClientFactory() : new NoopSdkClientFactory(),
    deps: [],
  }),
  safeProvider({
    provide: LoginEmailService,
    useClass: LoginEmailService,
    deps: [AccountService, AuthService, StateProvider],
  }),
  safeProvider({
    provide: ExtensionAnonLayoutWrapperDataService,
    useClass: ExtensionAnonLayoutWrapperDataService,
    deps: [],
  }),
  safeProvider({
    provide: LogoutService,
    useClass: ExtensionLogoutService,
    deps: [MessagingServiceAbstraction, AccountSwitcherService],
  }),
  safeProvider({
    provide: CompactModeService,
    useExisting: PopupCompactModeService,
    deps: [],
  }),
  safeProvider({
    provide: SsoComponentService,
    useClass: ExtensionSsoComponentService,
    deps: [SyncService, AuthService, EnvironmentService, I18nServiceAbstraction, LogService],
  }),
  safeProvider({
    provide: SshImportPromptService,
    useClass: DefaultSshImportPromptService,
    deps: [DialogService, ToastService, PlatformUtilsService, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: ChangePasswordService,
    useClass: ExtensionChangePasswordService,
    deps: [KeyService, MasterPasswordApiService, InternalMasterPasswordServiceAbstraction, WINDOW],
  }),
  safeProvider({
    provide: ServerNotificationsService,
    useClass: ForegroundServerNotificationsService,
    deps: [LogService],
  }),
  safeProvider({
    provide: DeviceManagementComponentServiceAbstraction,
    useClass: ExtensionDeviceManagementComponentService,
    deps: [],
  }),
];

@NgModule({
  imports: [JslibServicesModule],
  declarations: [],
  // Do not register your dependency here! Add it to the typesafeProviders array using the helper function
  providers: safeProviders,
})
export class ServicesModule {}
