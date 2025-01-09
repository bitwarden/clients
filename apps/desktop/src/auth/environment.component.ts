import { Component } from "@angular/core";

import { EnvironmentComponent as BaseEnvironmentComponent } from "@bitwarden/angular/auth/components/environment.component";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-environment",
  templateUrl: "environment.component.html",
})
export class EnvironmentComponent extends BaseEnvironmentComponent {
  constructor(
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    i18nService: I18nService,
    modalService: ModalService,
    toastService: ToastService,
  ) {
    super(platformUtilsService, environmentService, i18nService, modalService, toastService);
  }
}
