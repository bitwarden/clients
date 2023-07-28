import { Inject, Injectable } from "@angular/core";

import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeout.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import {
  EnvironmentService as EnvironmentServiceAbstraction,
  Urls,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { VaultTimeoutService as VaultTimeoutService } from "@bitwarden/common/services/vaultTimeout/vaultTimeout.service";

import { I18nService } from "../core/i18n.service";

@Injectable()
export class InitService {
  constructor(
    @Inject(WINDOW) private win: Window,
    private environmentService: EnvironmentServiceAbstraction,
    private notificationsService: NotificationsServiceAbstraction,
    private vaultTimeoutService: VaultTimeoutServiceAbstraction,
    private i18nService: I18nServiceAbstraction,
    private eventUploadService: EventUploadServiceAbstraction,
    private twoFactorService: TwoFactorServiceAbstraction,
    private stateService: StateServiceAbstraction,
    private cryptoService: CryptoServiceAbstraction,
    private themingService: AbstractThemingService,
    private encryptService: EncryptService
  ) {}

  init() {
    return async () => {
      await this.stateService.init();

      const urls = process.env.URLS as Urls;
      urls.base ??= this.win.location.origin;
      await this.environmentService.setUrls(urls);
      // Workaround to ignore stateService.activeAccount until process.env.URLS are set
      // TODO: Remove this when implementing ticket PM-2637
      this.environmentService.initialized = true;

      setTimeout(() => this.notificationsService.init(), 3000);
      (this.vaultTimeoutService as VaultTimeoutService).init(true);
      const locale = await this.stateService.getLocale();
      await (this.i18nService as I18nService).init(locale);
      (this.eventUploadService as EventUploadService).init(true);
      this.twoFactorService.init();
      const htmlEl = this.win.document.documentElement;
      htmlEl.classList.add("locale_" + this.i18nService.translationLocale);
      await this.themingService.monitorThemeChanges();
      const containerService = new ContainerService(this.cryptoService, this.encryptService);
      containerService.attachToGlobal(this.win);
    };
  }
}
