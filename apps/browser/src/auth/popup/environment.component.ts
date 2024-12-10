// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { EnvironmentComponent as BaseEnvironmentComponent } from "@bitwarden/angular/auth/components/environment.component";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { BrowserEnvironmentService } from "../../platform/services/browser-environment.service";

@Component({
  selector: "app-environment",
  templateUrl: "environment.component.html",
})
export class EnvironmentComponent extends BaseEnvironmentComponent implements OnInit {
  showEditedManagedSettings = false;

  constructor(
    platformUtilsService: PlatformUtilsService,
    public environmentService: BrowserEnvironmentService,
    i18nService: I18nService,
    private router: Router,
    modalService: ModalService,
    toastService: ToastService,
  ) {
    super(platformUtilsService, environmentService, i18nService, modalService, toastService);
    this.showCustom = true;
  }

  async ngOnInit() {
    this.showEditedManagedSettings = await this.environmentService.settingsHaveChanged();
  }

  async resetEnvironment() {
    const urls = await this.environmentService.getManagedEnvironment();

    this.baseUrl = urls.base;
    this.webVaultUrl = urls.webVault;
    this.apiUrl = urls.api;
    this.iconsUrl = urls.icons;
    this.identityUrl = urls.identity;
    this.notificationsUrl = urls.notifications;
    this.iconsUrl = urls.icons;
  }

  saved() {
    super.saved();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([""]);
  }
}
