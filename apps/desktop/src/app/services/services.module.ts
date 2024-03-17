import { APP_INITIALIZER, InjectionToken, NgModule } from "@angular/core";

import {
  SECURE_STORAGE,
  STATE_FACTORY,
  STATE_SERVICE_USE_CACHE,
  LOCALES_DIRECTORY,
  SYSTEM_LANGUAGE,
  MEMORY_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  WINDOW,
  SUPPORTS_SECURE_STORAGE,
  SYSTEM_THEME_OBSERVABLE,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { PolicyService as PolicyServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService as AccountServiceAbstraction } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService as LoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/login.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { LoginService } from "@bitwarden/common/auth/services/login.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BroadcasterService as BroadcasterServiceAbstraction } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { KeyGenerationService as KeyGenerationServiceAbstraction } from "@bitwarden/common/platform/abstractions/key-generation.service";
import {
  LogService,
  LogService as LogServiceAbstraction,
} from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { SystemService as SystemServiceAbstraction } from "@bitwarden/common/platform/abstractions/system.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { SystemService } from "@bitwarden/common/platform/services/system.service";
import { GlobalStateProvider, StateProvider } from "@bitwarden/common/platform/state";
// eslint-disable-next-line import/no-restricted-paths -- Implementation for memory storage
import { MemoryStorageService as MemoryStorageServiceForStateProviders } from "@bitwarden/common/platform/state/storage/memory-storage.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService } from "@bitwarden/components";

import { LoginGuard } from "../../auth/guards/login.guard";
import { Account } from "../../models/account";
import { ElectronCryptoService } from "../../platform/services/electron-crypto.service";
import { ElectronLogRendererService } from "../../platform/services/electron-log.renderer.service";
import {
  ELECTRON_SUPPORTS_SECURE_STORAGE,
  ElectronPlatformUtilsService,
} from "../../platform/services/electron-platform-utils.service";
import { ElectronRendererMessagingService } from "../../platform/services/electron-renderer-messaging.service";
import { ElectronRendererSecureStorageService } from "../../platform/services/electron-renderer-secure-storage.service";
import { ElectronRendererStorageService } from "../../platform/services/electron-renderer-storage.service";
import { ElectronStateService } from "../../platform/services/electron-state.service";
import { I18nRendererService } from "../../platform/services/i18n.renderer.service";
import { fromIpcSystemTheme } from "../../platform/utils/from-ipc-system-theme";
import { EncryptedMessageHandlerService } from "../../services/encrypted-message-handler.service";
import { NativeMessageHandlerService } from "../../services/native-message-handler.service";
import { NativeMessagingService } from "../../services/native-messaging.service";
import { SearchBarService } from "../layout/search/search-bar.service";

import { DesktopFileDownloadService } from "./desktop-file-download.service";
import { InitService } from "./init.service";
import { RendererCryptoFunctionService } from "./renderer-crypto-function.service";

const RELOAD_CALLBACK = new InjectionToken<() => any>("RELOAD_CALLBACK");

@NgModule({
  imports: [JslibServicesModule],
  declarations: [],
  providers: [
    InitService,
    NativeMessagingService,
    SearchBarService,
    LoginGuard,
    DialogService,
    {
      provide: APP_INITIALIZER,
      useFactory: (initService: InitService) => initService.init(),
      deps: [InitService],
      multi: true,
    },
    {
      provide: STATE_FACTORY,
      useValue: new StateFactory(GlobalState, Account),
    },
    {
      provide: RELOAD_CALLBACK,
      useValue: null,
    },
    { provide: LogServiceAbstraction, useClass: ElectronLogRendererService, deps: [] },
    {
      provide: PlatformUtilsServiceAbstraction,
      useClass: ElectronPlatformUtilsService,
      deps: [I18nServiceAbstraction, MessagingServiceAbstraction],
    },
    {
      // We manually override the value of SUPPORTS_SECURE_STORAGE here to avoid
      // the TokenService having to inject the PlatformUtilsService which introduces a
      // circular dependency on Desktop only.
      provide: SUPPORTS_SECURE_STORAGE,
      useValue: ELECTRON_SUPPORTS_SECURE_STORAGE,
    },
    {
      provide: I18nServiceAbstraction,
      useClass: I18nRendererService,
      deps: [SYSTEM_LANGUAGE, LOCALES_DIRECTORY, GlobalStateProvider],
    },
    {
      provide: MessagingServiceAbstraction,
      useClass: ElectronRendererMessagingService,
      deps: [BroadcasterServiceAbstraction],
    },
    { provide: AbstractStorageService, useClass: ElectronRendererStorageService },
    { provide: SECURE_STORAGE, useClass: ElectronRendererSecureStorageService },
    { provide: MEMORY_STORAGE, useClass: MemoryStorageService },
    { provide: OBSERVABLE_MEMORY_STORAGE, useClass: MemoryStorageServiceForStateProviders },
    { provide: OBSERVABLE_DISK_STORAGE, useExisting: AbstractStorageService },
    {
      provide: SystemServiceAbstraction,
      useClass: SystemService,
      deps: [
        MessagingServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        RELOAD_CALLBACK,
        StateServiceAbstraction,
        AutofillSettingsServiceAbstraction,
        VaultTimeoutSettingsService,
        BiometricStateService,
      ],
    },
    {
      provide: StateServiceAbstraction,
      useClass: ElectronStateService,
      deps: [
        AbstractStorageService,
        SECURE_STORAGE,
        MEMORY_STORAGE,
        LogService,
        STATE_FACTORY,
        AccountServiceAbstraction,
        EnvironmentService,
        TokenService,
        MigrationRunner,
        STATE_SERVICE_USE_CACHE,
      ],
    },
    {
      provide: FileDownloadService,
      useClass: DesktopFileDownloadService,
    },
    {
      provide: SYSTEM_THEME_OBSERVABLE,
      useFactory: () => fromIpcSystemTheme(),
    },
    {
      provide: EncryptedMessageHandlerService,
      deps: [
        StateServiceAbstraction,
        AuthServiceAbstraction,
        CipherServiceAbstraction,
        PolicyServiceAbstraction,
        MessagingServiceAbstraction,
        PasswordGenerationServiceAbstraction,
      ],
    },
    {
      provide: NativeMessageHandlerService,
      deps: [
        StateServiceAbstraction,
        CryptoServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        MessagingServiceAbstraction,
        EncryptedMessageHandlerService,
        DialogService,
      ],
    },
    {
      provide: LoginServiceAbstraction,
      useClass: LoginService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: CryptoFunctionServiceAbstraction,
      useClass: RendererCryptoFunctionService,
      deps: [WINDOW],
    },
    {
      provide: CryptoServiceAbstraction,
      useClass: ElectronCryptoService,
      deps: [
        KeyGenerationServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        EncryptService,
        PlatformUtilsServiceAbstraction,
        LogService,
        StateServiceAbstraction,
        AccountServiceAbstraction,
        StateProvider,
        BiometricStateService,
      ],
    },
  ],
})
export class ServicesModule {}
