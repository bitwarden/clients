import { Component } from "@angular/core";

import { PremiumComponent as BasePremiumComponent } from "@bitwarden/angular/billing/components/premium.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-premium",
  templateUrl: "premium.component.html",
  standalone: false,
})
export class PremiumComponent extends BasePremiumComponent {
  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    logService: LogService,
    dialogService: DialogService,
    environmentService: EnvironmentService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    toastService: ToastService,
    accountService: AccountService,
    billingApiService: BillingApiServiceAbstraction,
  ) {
    super(
      i18nService,
      platformUtilsService,
      apiService,
      logService,
      dialogService,
      environmentService,
      billingAccountProfileStateService,
      toastService,
      accountService,
      billingApiService,
    );
  }
}
