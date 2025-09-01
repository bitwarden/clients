// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { APP_INITIALIZER, NgModule } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, merge } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { LoginApprovalDialogComponentServiceAbstraction } from "@bitwarden/angular/auth/login-approval";
import { SetInitialPasswordService } from "@bitwarden/angular/auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import {
  SECURE_STORAGE,
  LOCALES_DIRECTORY,
  SYSTEM_LANGUAGE,
  MEMORY_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  WINDOW,
  SUPPORTS_SECURE_STORAGE,
  SYSTEM_THEME_OBSERVABLE,
  SafeInjectionToken,
  DEFAULT_VAULT_TIMEOUT,
  INTRAPROCESS_MESSAGING_SUBJECT,
  CLIENT_TYPE,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import {
  LoginComponentService,
  SsoComponentService,
  DefaultSsoComponentService,
  TwoFactorAuthDuoComponentService,
} from "@bitwarden/auth/angular";
import {
  InternalUserDecryptionOptionsServiceAbstraction,
  LoginEmailService,
  SsoUrlService,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyService as PolicyServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  AccountService,
  AccountService as AccountServiceAbstraction,
} from "@bitwarden/common/auth/abstractions/account.service";
import {
  AuthService,
  AuthService as AuthServiceAbstraction,
} from "@bitwarden/common/auth/abstractions/auth.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { WebCryptoFunctionService } from "@bitwarden/common/key-management/crypto/services/web-crypto-function.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { DefaultProcessReloadService } from "@bitwarden/common/key-management/services/default-process-reload.service";
import {
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Fido2AuthenticatorService as Fido2AuthenticatorServiceAbstraction } from "@bitwarden/common/platform/abstractions/fido2/fido2-authenticator.service.abstraction";
import { Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction } from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  LogService,
  LogService as LogServiceAbstraction,
} from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { SystemService as SystemServiceAbstraction } from "@bitwarden/common/platform/abstractions/system.service";
import { Message, MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- Used for dependency injection
import { SubjectMessageSender } from "@bitwarden/common/platform/messaging/internal";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { Fido2AuthenticatorService } from "@bitwarden/common/platform/services/fido2/fido2-authenticator.service";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";
import { DefaultSdkClientFactory } from "@bitwarden/common/platform/services/sdk/default-sdk-client-factory";
import { DefaultSdkLoadService } from "@bitwarden/common/platform/services/sdk/default-sdk-load.service";
import { NoopSdkClientFactory } from "@bitwarden/common/platform/services/sdk/noop-sdk-client-factory";
import { NoopSdkLoadService } from "@bitwarden/common/platform/services/sdk/noop-sdk-load.service";
import { SystemService } from "@bitwarden/common/platform/services/system.service";
import { GlobalStateProvider, StateProvider } from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import {
  KdfConfigService,
  KeyService,
  KeyService as KeyServiceAbstraction,
  BiometricStateService,
  BiometricsService,
} from "@bitwarden/key-management";
import { LockComponentService } from "@bitwarden/key-management-ui";
import { SerializedMemoryStorageService } from "@bitwarden/storage-core";
import { DefaultSshImportPromptService, SshImportPromptService } from "@bitwarden/vault";

import { DesktopLoginApprovalDialogComponentService } from "../../auth/login/desktop-login-approval-dialog-component.service";
import { DesktopLoginComponentService } from "../../auth/login/desktop-login-component.service";
import { DesktopTwoFactorAuthDuoComponentService } from "../../auth/services/desktop-two-factor-auth-duo-component.service";
import { DesktopAutofillSettingsService } from "../../autofill/services/desktop-autofill-settings.service";
import { DesktopAutofillService } from "../../autofill/services/desktop-autofill.service";
import { DesktopAutotypeService } from "../../autofill/services/desktop-autotype.service";
import { DesktopFido2UserInterfaceService } from "../../autofill/services/desktop-fido2-user-interface.service";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";
import { RendererBiometricsService } from "../../key-management/biometrics/renderer-biometrics.service";
import { ElectronKeyService } from "../../key-management/electron-key.service";
import { DesktopLockComponentService } from "../../key-management/lock/services/desktop-lock-component.service";
import { flagEnabled } from "../../platform/flags";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { ElectronLogRendererService } from "../../platform/services/electron-log.renderer.service";
import {
  ELECTRON_SUPPORTS_SECURE_STORAGE,
  ElectronPlatformUtilsService,
} from "../../platform/services/electron-platform-utils.service";
import { ElectronRendererMessageSender } from "../../platform/services/electron-renderer-message.sender";
import { ElectronRendererSecureStorageService } from "../../platform/services/electron-renderer-secure-storage.service";
import { ElectronRendererStorageService } from "../../platform/services/electron-renderer-storage.service";
import { I18nRendererService } from "../../platform/services/i18n.renderer.service";
import { fromIpcMessaging } from "../../platform/utils/from-ipc-messaging";
import { fromIpcSystemTheme } from "../../platform/utils/from-ipc-system-theme";
import { BiometricMessageHandlerService } from "../../services/biometric-message-handler.service";
import { DuckDuckGoMessageHandlerService } from "../../services/duckduckgo-message-handler.service";
import { EncryptedMessageHandlerService } from "../../services/encrypted-message-handler.service";
import { NativeMessagingService } from "../../services/native-messaging.service";
import { SearchBarService } from "../layout/search/search-bar.service";

import { DesktopFileDownloadService } from "./desktop-file-download.service";
import { InitService } from "./init.service";
import { NativeMessagingManifestService } from "./native-messaging-manifest.service";
import { DesktopSetInitialPasswordService } from "./set-initial-password/desktop-set-initial-password.service";

const RELOAD_CALLBACK = new SafeInjectionToken<() => any>("RELOAD_CALLBACK");

/**
 * Provider definitions used in the ngModule.
 * Add your provider definition here using the safeProvider function as a wrapper. This will give you type safety.
 * If you need help please ask for it, do NOT change the type of this array.
 */
const safeProviders: SafeProvider[] = [
  safeProvider(InitService),
  safeProvider({
    provide: BiometricsService,
    useClass: RendererBiometricsService,
    deps: [],
  }),
  safeProvider({
    provide: DesktopBiometricsService,
    useClass: RendererBiometricsService,
    deps: [],
  }),
  safeProvider(NativeMessagingService),
  safeProvider(BiometricMessageHandlerService),
  safeProvider(SearchBarService),
  safeProvider(DialogService),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
    useFactory: (initService: InitService) => initService.init(),
    deps: [InitService],
    multi: true,
  }),
  safeProvider({
    provide: RELOAD_CALLBACK,
    useValue: null,
  }),
  safeProvider({
    provide: LogServiceAbstraction,
    useClass: ElectronLogRendererService,
    deps: [],
  }),
  safeProvider({
    provide: PlatformUtilsServiceAbstraction,
    useClass: ElectronPlatformUtilsService,
    deps: [I18nServiceAbstraction, MessagingServiceAbstraction],
  }),
  safeProvider({
    // We manually override the value of SUPPORTS_SECURE_STORAGE here to avoid
    // the TokenService having to inject the PlatformUtilsService which introduces a
    // circular dependency on Desktop only.
    provide: SUPPORTS_SECURE_STORAGE,
    useValue: ELECTRON_SUPPORTS_SECURE_STORAGE,
  }),
  safeProvider({
    provide: DEFAULT_VAULT_TIMEOUT,
    useValue: VaultTimeoutStringType.OnRestart,
  }),
  safeProvider({
    provide: I18nServiceAbstraction,
    useClass: I18nRendererService,
    deps: [SYSTEM_LANGUAGE, LOCALES_DIRECTORY, GlobalStateProvider],
  }),
  safeProvider({
    provide: MessageSender,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>) =>
      MessageSender.combine(
        new ElectronRendererMessageSender(), // Communication with main process
        new SubjectMessageSender(subject), // Communication with ourself
      ),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT],
  }),
  safeProvider({
    provide: MessageListener,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>) =>
      new MessageListener(
        merge(
          subject.asObservable(), // For messages from the same context
          fromIpcMessaging(), // For messages from the main process
        ),
      ),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT],
  }),
  safeProvider({
    provide: AbstractStorageService,
    useClass: ElectronRendererStorageService,
    deps: [],
  }),
  safeProvider({
    provide: SECURE_STORAGE,
    useClass: ElectronRendererSecureStorageService,
    deps: [],
  }),
  safeProvider({ provide: MEMORY_STORAGE, useClass: MemoryStorageService, deps: [] }),
  safeProvider({
    provide: OBSERVABLE_MEMORY_STORAGE,
    useClass: SerializedMemoryStorageService,
    deps: [],
  }),
  safeProvider({ provide: OBSERVABLE_DISK_STORAGE, useExisting: AbstractStorageService }),
  safeProvider({
    provide: SystemServiceAbstraction,
    useClass: SystemService,
    deps: [
      PlatformUtilsServiceAbstraction,
      AutofillSettingsServiceAbstraction,
      TaskSchedulerService,
    ],
  }),
  safeProvider({
    provide: ProcessReloadServiceAbstraction,
    useClass: DefaultProcessReloadService,
    deps: [
      PinServiceAbstraction,
      MessagingServiceAbstraction,
      RELOAD_CALLBACK,
      VaultTimeoutSettingsService,
      BiometricStateService,
      AccountServiceAbstraction,
      LogService,
    ],
  }),
  safeProvider({
    provide: FileDownloadService,
    useClass: DesktopFileDownloadService,
    deps: [],
  }),
  safeProvider({
    provide: SYSTEM_THEME_OBSERVABLE,
    useFactory: () => fromIpcSystemTheme(),
    deps: [],
  }),
  safeProvider({
    provide: EncryptedMessageHandlerService,
    deps: [
      AccountServiceAbstraction,
      AuthServiceAbstraction,
      CipherServiceAbstraction,
      PolicyServiceAbstraction,
      MessagingServiceAbstraction,
      PasswordGenerationServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: DuckDuckGoMessageHandlerService,
    deps: [
      StateServiceAbstraction,
      EncryptService,
      CryptoFunctionServiceAbstraction,
      MessagingServiceAbstraction,
      EncryptedMessageHandlerService,
      DialogService,
      DesktopAutofillSettingsService,
    ],
  }),
  safeProvider({
    provide: CryptoFunctionServiceAbstraction,
    useClass: WebCryptoFunctionService,
    deps: [WINDOW],
  }),
  safeProvider({
    provide: KeyServiceAbstraction,
    useClass: ElectronKeyService,
    deps: [
      InternalMasterPasswordServiceAbstraction,
      KeyGenerationService,
      CryptoFunctionServiceAbstraction,
      EncryptService,
      PlatformUtilsServiceAbstraction,
      LogService,
      StateServiceAbstraction,
      AccountServiceAbstraction,
      StateProvider,
      BiometricStateService,
      KdfConfigService,
      DesktopBiometricsService,
    ],
  }),
  safeProvider({
    provide: DesktopSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: DesktopAutofillSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: DesktopAutofillService,
    deps: [
      LogService,
      CipherServiceAbstraction,
      ConfigService,
      Fido2AuthenticatorServiceAbstraction,
      AccountService,
    ],
  }),
  safeProvider({
    provide: DesktopFido2UserInterfaceService,
    useClass: DesktopFido2UserInterfaceService,
    deps: [
      AuthServiceAbstraction,
      CipherServiceAbstraction,
      AccountService,
      LogService,
      MessagingServiceAbstraction,
      Router,
      DesktopSettingsService,
    ],
  }),
  safeProvider({
    provide: Fido2UserInterfaceServiceAbstraction, // We utilize desktop specific methods when wiring OS API's
    useExisting: DesktopFido2UserInterfaceService,
  }),
  safeProvider({
    provide: Fido2AuthenticatorServiceAbstraction,
    useClass: Fido2AuthenticatorService,
    deps: [
      CipherServiceAbstraction,
      Fido2UserInterfaceServiceAbstraction,
      SyncService,
      AccountService,
      LogService,
    ],
  }),
  safeProvider({
    provide: NativeMessagingManifestService,
    useClass: NativeMessagingManifestService,
    deps: [],
  }),
  safeProvider({
    provide: LockComponentService,
    useClass: DesktopLockComponentService,
    deps: [],
  }),
  safeProvider({
    provide: CLIENT_TYPE,
    useValue: ClientType.Desktop,
  }),
  safeProvider({
    provide: SetInitialPasswordService,
    useClass: DesktopSetInitialPasswordService,
    deps: [
      ApiService,
      EncryptService,
      I18nServiceAbstraction,
      KdfConfigService,
      KeyService,
      MasterPasswordApiService,
      InternalMasterPasswordServiceAbstraction,
      OrganizationApiServiceAbstraction,
      OrganizationUserApiService,
      InternalUserDecryptionOptionsServiceAbstraction,
      MessagingServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: SsoUrlService,
    useClass: SsoUrlService,
    deps: [],
  }),
  safeProvider({
    provide: LoginComponentService,
    useClass: DesktopLoginComponentService,
    deps: [
      CryptoFunctionServiceAbstraction,
      EnvironmentService,
      PasswordGenerationServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      SsoLoginServiceAbstraction,
      I18nServiceAbstraction,
      ToastService,
      SsoUrlService,
    ],
  }),
  safeProvider({
    provide: TwoFactorAuthDuoComponentService,
    useClass: DesktopTwoFactorAuthDuoComponentService,
    deps: [
      MessageListener,
      EnvironmentService,
      I18nServiceAbstraction,
      PlatformUtilsServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: SdkClientFactory,
    useClass: flagEnabled("sdk") ? DefaultSdkClientFactory : NoopSdkClientFactory,
    deps: [],
  }),
  safeProvider({
    provide: SdkLoadService,
    useClass: flagEnabled("sdk") ? DefaultSdkLoadService : NoopSdkLoadService,
    deps: [],
  }),
  safeProvider({
    provide: LoginEmailService,
    useClass: LoginEmailService,
    deps: [AccountService, AuthService, StateProvider],
  }),
  safeProvider({
    provide: SsoComponentService,
    useClass: DefaultSsoComponentService,
    deps: [],
  }),
  safeProvider({
    provide: LoginApprovalDialogComponentServiceAbstraction,
    useClass: DesktopLoginApprovalDialogComponentService,
    deps: [I18nServiceAbstraction],
  }),
  safeProvider({
    provide: SshImportPromptService,
    useClass: DefaultSshImportPromptService,
    deps: [DialogService, ToastService, PlatformUtilsServiceAbstraction, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: DesktopAutotypeService,
    useClass: DesktopAutotypeService,
    deps: [
      AccountService,
      AuthService,
      CipherServiceAbstraction,
      ConfigService,
      GlobalStateProvider,
      PlatformUtilsServiceAbstraction,
    ],
  }),
];

@NgModule({
  imports: [JslibServicesModule],
  declarations: [],
  // Do not register your dependency here! Add it to the typesafeProviders array using the helper function
  providers: safeProviders,
})
export class ServicesModule {}
