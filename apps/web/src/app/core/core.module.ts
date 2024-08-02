import { CommonModule } from "@angular/common";
import { APP_INITIALIZER, NgModule, Optional, SkipSelf } from "@angular/core";

import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import {
  SECURE_STORAGE,
  LOCALES_DIRECTORY,
  SYSTEM_LANGUAGE,
  MEMORY_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_DISK_LOCAL_STORAGE,
  WINDOW,
  SafeInjectionToken,
  DEFAULT_VAULT_TIMEOUT,
  CLIENT_TYPE,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import { ModalService as ModalServiceAbstraction } from "@bitwarden/angular/services/modal.service";
import {
  SetPasswordJitService,
  RegistrationFinishService as RegistrationFinishServiceAbstraction,
} from "@bitwarden/auth/angular";
import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountApiService as AccountApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/account-api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";
// eslint-disable-next-line import/no-restricted-paths -- Implementation for memory storage
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { StorageServiceProvider } from "@bitwarden/common/platform/services/storage-service.provider";
/* eslint-disable import/no-restricted-paths -- Implementation for memory storage */
import { GlobalStateProvider, StateProvider } from "@bitwarden/common/platform/state";
import { MemoryStorageService as MemoryStorageServiceForStateProviders } from "@bitwarden/common/platform/state/storage/memory-storage.service";
/* eslint-enable import/no-restricted-paths -- Implementation for memory storage */
import {
  DefaultThemeStateService,
  ThemeStateService,
} from "@bitwarden/common/platform/theming/theme-state.service";
import { VaultTimeout, VaultTimeoutStringType } from "@bitwarden/common/types/vault-timeout.type";

import { PolicyListService } from "../admin-console/core/policy-list.service";
import { WebSetPasswordJitService, WebRegistrationFinishService } from "../auth";
import { AcceptOrganizationInviteService } from "../auth/organization-invite/accept-organization.service";
import { HtmlStorageService } from "../core/html-storage.service";
import { I18nService } from "../core/i18n.service";
import { WebEnvironmentService } from "../platform/web-environment.service";
import { WebMigrationRunner } from "../platform/web-migration-runner";
import { WebStorageServiceProvider } from "../platform/web-storage-service.provider";
import { WindowStorageService } from "../platform/window-storage.service";
import { CollectionAdminService } from "../vault/core/collection-admin.service";

import { EventService } from "./event.service";
import { InitService } from "./init.service";
import { ModalService } from "./modal.service";
import { RouterService } from "./router.service";
import { StateService as WebStateService } from "./state";
import { WebFileDownloadService } from "./web-file-download.service";
import { WebPlatformUtilsService } from "./web-platform-utils.service";

/**
 * Provider definitions used in the ngModule.
 * Add your provider definition here using the safeProvider function as a wrapper. This will give you type safety.
 * If you need help please ask for it, do NOT change the type of this array.
 */
const safeProviders: SafeProvider[] = [
  safeProvider(InitService),
  safeProvider(RouterService),
  safeProvider(EventService),
  safeProvider(PolicyListService),
  safeProvider({
    provide: DEFAULT_VAULT_TIMEOUT,
    deps: [PlatformUtilsServiceAbstraction],
    useFactory: (platformUtilsService: PlatformUtilsServiceAbstraction): VaultTimeout =>
      platformUtilsService.isDev() ? VaultTimeoutStringType.Never : 15,
  }),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
    useFactory: (initService: InitService) => initService.init(),
    deps: [InitService],
    multi: true,
  }),
  safeProvider({
    provide: I18nServiceAbstraction,
    useClass: I18nService,
    deps: [SYSTEM_LANGUAGE, LOCALES_DIRECTORY, GlobalStateProvider],
  }),
  safeProvider({ provide: AbstractStorageService, useClass: HtmlStorageService, deps: [] }),
  safeProvider({
    provide: SECURE_STORAGE,
    // TODO: platformUtilsService.isDev has a helper for this, but using that service here results in a circular dependency.
    // We have a tech debt item in the backlog to break up platformUtilsService, but in the meantime simply checking the environment here is less cumbersome.
    useClass: process.env.NODE_ENV === "development" ? HtmlStorageService : MemoryStorageService,
    deps: [],
  }),
  safeProvider({
    provide: MEMORY_STORAGE,
    useClass: MemoryStorageService,
    deps: [],
  }),
  safeProvider({
    provide: OBSERVABLE_MEMORY_STORAGE,
    useClass: MemoryStorageServiceForStateProviders,
    deps: [],
  }),
  safeProvider({
    provide: OBSERVABLE_DISK_STORAGE,
    useFactory: () => new WindowStorageService(window.sessionStorage),
    deps: [],
  }),
  safeProvider({
    provide: PlatformUtilsServiceAbstraction,
    useClass: WebPlatformUtilsService,
    useAngularDecorators: true,
  }),
  safeProvider({
    provide: ModalServiceAbstraction,
    useClass: ModalService,
    useAngularDecorators: true,
  }),
  safeProvider(WebStateService),
  safeProvider({
    provide: StateService,
    useExisting: WebStateService,
  }),
  safeProvider({
    provide: FileDownloadService,
    useClass: WebFileDownloadService,
    useAngularDecorators: true,
  }),
  safeProvider(CollectionAdminService),
  safeProvider({
    provide: WindowStorageService,
    useFactory: () => new WindowStorageService(window.localStorage),
    deps: [],
  }),
  safeProvider({
    provide: OBSERVABLE_DISK_LOCAL_STORAGE,
    useExisting: WindowStorageService,
  }),
  safeProvider({
    provide: StorageServiceProvider,
    useClass: WebStorageServiceProvider,
    deps: [OBSERVABLE_DISK_STORAGE, OBSERVABLE_MEMORY_STORAGE, OBSERVABLE_DISK_LOCAL_STORAGE],
  }),
  safeProvider({
    provide: MigrationRunner,
    useClass: WebMigrationRunner,
    deps: [AbstractStorageService, LogService, MigrationBuilderService, WindowStorageService],
  }),
  safeProvider({
    provide: EnvironmentService,
    useClass: WebEnvironmentService,
    deps: [WINDOW, StateProvider, AccountService],
  }),
  safeProvider({
    provide: ThemeStateService,
    useFactory: (globalStateProvider: GlobalStateProvider) =>
      // Web chooses to have Light as the default theme
      new DefaultThemeStateService(globalStateProvider, ThemeType.Light),
    deps: [GlobalStateProvider],
  }),
  safeProvider({
    provide: CLIENT_TYPE,
    useValue: ClientType.Web,
  }),
  safeProvider({
    provide: RegistrationFinishServiceAbstraction,
    useClass: WebRegistrationFinishService,
    deps: [
      CryptoServiceAbstraction,
      AccountApiServiceAbstraction,
      AcceptOrganizationInviteService,
      PolicyApiServiceAbstraction,
      LogService,
      PolicyService,
    ],
  }),
  safeProvider({
    provide: SetPasswordJitService,
    useClass: WebSetPasswordJitService,
    deps: [
      ApiService,
      CryptoServiceAbstraction,
      I18nServiceAbstraction,
      KdfConfigService,
      InternalMasterPasswordServiceAbstraction,
      OrganizationApiServiceAbstraction,
      OrganizationUserService,
      InternalUserDecryptionOptionsServiceAbstraction,
    ],
  }),
];

@NgModule({
  declarations: [],
  imports: [CommonModule, JslibServicesModule],
  // Do not register your dependency here! Add it to the typesafeProviders array using the helper function
  providers: safeProviders,
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule?: CoreModule) {
    if (parentModule) {
      throw new Error("CoreModule is already loaded. Import it in the AppModule only");
    }
  }
}
