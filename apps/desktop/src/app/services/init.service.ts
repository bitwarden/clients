import { Inject, Injectable } from "@angular/core";

import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeout.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService as EnvironmentServiceAbstraction } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vaultTimeout/vaultTimeout.service";
import { SyncService as SyncServiceAbstraction } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { I18nService } from "../../platform/services/i18n.service";
import { NativeMessagingService } from "../../services/native-messaging.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private environmentService: EnvironmentServiceAbstraction,
    private syncService: SyncServiceAbstraction,
    private vaultTimeoutService: VaultTimeoutServiceAbstraction,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private notificationsService: NotificationsServiceAbstraction,
    private platformUtilsService: PlatformUtilsServiceAbstraction,
    private stateService: StateServiceAbstraction,
    private cryptoService: CryptoServiceAbstraction,
    private nativeMessagingService: NativeMessagingService,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService
  ) {}

  init() {
    return async () => {
      this.nativeMessagingService.init();
      await this.stateService.init();
      await this.environmentService.setUrlsFromStorage();
      // Workaround to ignore stateService.activeAccount until URLs are set
      // TODO: Remove this when implementing ticket PM-2637
      this.environmentService.initialized = true;
      this.syncService.fullSync(true);
      (this.vaultTimeoutService as VaultTimeoutService).init(true);
      const locale = await this.stateService.getLocale();
      await (this.i18nService as I18nService).init(locale);
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      setTimeout(() => this.notificationsService.init(), 3000);
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("os_" + this.platformUtilsService.getDeviceString());
      await this.themingService.monitorThemeChanges();
      let installAction = null;
      const installedVersion = await this.stateService.getInstalledVersion();
      const currentVersion = await this.platformUtilsService.getApplicationVersion();
      if (installedVersion == null) {
        installAction = "install";
      } else if (installedVersion !== currentVersion) {
        installAction = "update";
      }

      if (installAction != null) {
        await this.stateService.setInstalledVersion(currentVersion);
      }

      const containerService = new ContainerService(this.cryptoService, this.encryptService);
      containerService.attachToGlobal(this.win);
    };
  }
}
