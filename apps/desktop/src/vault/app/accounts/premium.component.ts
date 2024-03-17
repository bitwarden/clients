import { Component } from "@angular/core";

import { PremiumComponent as BasePremiumComponent } from "@bitwarden/angular/vault/components/premium.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-premium",
  templateUrl: "premium.component.html",
})
export class PremiumComponent extends BasePremiumComponent {
  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    logService: LogService,
    stateService: StateService,
    dialogService: DialogService,
    environmentService: EnvironmentService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    super(
      i18nService,
      platformUtilsService,
      apiService,
      logService,
      stateService,
      dialogService,
      environmentService,
      billingAccountProfileStateService,
    );
  }
}
