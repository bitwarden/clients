// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { ModalService } from "../../services/modal.service";

@Directive()
export class EnvironmentComponent {
  @Output() onSaved = new EventEmitter();

  iconsUrl: string;
  identityUrl: string;
  apiUrl: string;
  webVaultUrl: string;
  notificationsUrl: string;
  baseUrl: string;
  showCustom = false;

  constructor(
    protected platformUtilsService: PlatformUtilsService,
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    private modalService: ModalService,
    private toastService: ToastService,
  ) {
    this.environmentService.environment$.pipe(takeUntilDestroyed()).subscribe((env) => {
      if (env.getRegion() !== Region.SelfHosted) {
        this.baseUrl = "";
        this.webVaultUrl = "";
        this.apiUrl = "";
        this.identityUrl = "";
        this.iconsUrl = "";
        this.notificationsUrl = "";
        return;
      }

      const urls = env.getUrls();
      this.baseUrl = urls.base || "";
      this.webVaultUrl = urls.webVault || "";
      this.apiUrl = urls.api || "";
      this.identityUrl = urls.identity || "";
      this.iconsUrl = urls.icons || "";
      this.notificationsUrl = urls.notifications || "";
    });
  }

  async submit() {
    await this.environmentService.setEnvironment(Region.SelfHosted, {
      base: this.baseUrl,
      api: this.apiUrl,
      identity: this.identityUrl,
      webVault: this.webVaultUrl,
      icons: this.iconsUrl,
      notifications: this.notificationsUrl,
    });

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("environmentSaved"),
    });
    this.saved();
  }

  toggleCustom() {
    this.showCustom = !this.showCustom;
  }

  protected saved() {
    this.onSaved.emit();
    this.modalService.closeAll();
  }
}
