import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { TwoFactorOptionsComponentV1 as BaseTwoFactorOptionsComponentV1 } from "@bitwarden/angular/auth/components/two-factor-options-v1.component";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-two-factor-options",
  templateUrl: "two-factor-options-v1.component.html",
})
export class TwoFactorOptionsComponentV1 extends BaseTwoFactorOptionsComponentV1 {
  constructor(
    twoFactorService: TwoFactorService,
    router: Router,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
  ) {
    super(twoFactorService, router, i18nService, platformUtilsService, window, environmentService);
  }
}
