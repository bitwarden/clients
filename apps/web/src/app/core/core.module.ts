import { CommonModule } from "@angular/common";
import { APP_INITIALIZER, NgModule, Optional, SkipSelf } from "@angular/core";

import {
  SECURE_STORAGE,
  STATE_FACTORY,
  STATE_SERVICE_USE_CACHE,
  LOCALES_DIRECTORY,
  SYSTEM_LANGUAGE,
  MEMORY_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_DISK_LOCAL_STORAGE,
  WINDOW,
} from "@bitwarden/angular/services/injection-tokens";
import { JslibServicesModule } from "@bitwarden/angular/services/jslib-services.module";
import { ModalService as ModalServiceAbstraction } from "@bitwarden/angular/services/modal.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LoginService as LoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/login.service";
import { LoginService } from "@bitwarden/common/auth/services/login.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { MemoryStorageService } from "@bitwarden/common/platform/services/memory-storage.service";
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

import { PolicyListService } from "../admin-console/core/policy-list.service";
import { HtmlStorageService } from "../core/html-storage.service";
import { I18nService } from "../core/i18n.service";
import { WebEnvironmentService } from "../platform/web-environment.service";
import { WebMigrationRunner } from "../platform/web-migration-runner";
import { WebStorageServiceProvider } from "../platform/web-storage-service.provider";
import { WindowStorageService } from "../platform/window-storage.service";
import { CollectionAdminService } from "../vault/core/collection-admin.service";

import { BroadcasterMessagingService } from "./broadcaster-messaging.service";
import { EventService } from "./event.service";
import { InitService } from "./init.service";
import { ModalService } from "./modal.service";
import { RouterService } from "./router.service";
import { Account, GlobalState, StateService } from "./state";
import { WebFileDownloadService } from "./web-file-download.service";
import { WebPlatformUtilsService } from "./web-platform-utils.service";

@NgModule({
  declarations: [],
  imports: [CommonModule, JslibServicesModule],
  providers: [
    InitService,
    RouterService,
    EventService,
    PolicyListService,
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
      provide: STATE_SERVICE_USE_CACHE,
      useValue: false,
    },
    {
      provide: I18nServiceAbstraction,
      useClass: I18nService,
      deps: [SYSTEM_LANGUAGE, LOCALES_DIRECTORY, GlobalStateProvider],
    },
    { provide: AbstractStorageService, useClass: HtmlStorageService },
    {
      provide: SECURE_STORAGE,
      // TODO: platformUtilsService.isDev has a helper for this, but using that service here results in a circular dependency.
      // We have a tech debt item in the backlog to break up platformUtilsService, but in the meantime simply checking the environment here is less cumbersome.
      useClass: process.env.NODE_ENV === "development" ? HtmlStorageService : MemoryStorageService,
    },
    {
      provide: MEMORY_STORAGE,
      useClass: MemoryStorageService,
    },
    { provide: OBSERVABLE_MEMORY_STORAGE, useClass: MemoryStorageServiceForStateProviders },
    {
      provide: OBSERVABLE_DISK_STORAGE,
      useFactory: () => new WindowStorageService(window.sessionStorage),
    },
    {
      provide: PlatformUtilsServiceAbstraction,
      useClass: WebPlatformUtilsService,
    },
    { provide: MessagingServiceAbstraction, useClass: BroadcasterMessagingService },
    { provide: ModalServiceAbstraction, useClass: ModalService },
    StateService,
    {
      provide: BaseStateServiceAbstraction,
      useExisting: StateService,
    },
    {
      provide: FileDownloadService,
      useClass: WebFileDownloadService,
    },
    {
      provide: LoginServiceAbstraction,
      useClass: LoginService,
      deps: [StateService],
    },
    CollectionAdminService,
    {
      provide: OBSERVABLE_DISK_LOCAL_STORAGE,
      useFactory: () => new WindowStorageService(window.localStorage),
    },
    {
      provide: StorageServiceProvider,
      useClass: WebStorageServiceProvider,
      deps: [OBSERVABLE_DISK_STORAGE, OBSERVABLE_MEMORY_STORAGE, OBSERVABLE_DISK_LOCAL_STORAGE],
    },
    {
      provide: MigrationRunner,
      useClass: WebMigrationRunner,
      deps: [
        AbstractStorageService,
        LogService,
        MigrationBuilderService,
        OBSERVABLE_DISK_LOCAL_STORAGE,
      ],
    },
    {
      provide: EnvironmentService,
      useClass: WebEnvironmentService,
      deps: [WINDOW, StateProvider, AccountService],
    },
    {
      provide: ThemeStateService,
      useFactory: (globalStateProvider: GlobalStateProvider) =>
        // Web chooses to have Light as the default theme
        new DefaultThemeStateService(globalStateProvider, ThemeType.Light),
      deps: [GlobalStateProvider],
    },
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule?: CoreModule) {
    if (parentModule) {
      throw new Error("CoreModule is already loaded. Import it in the AppModule only");
    }
  }
}
