// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CurrencyPipe, Location } from "@angular/common";
import { Component } from "@angular/core";

import { PremiumComponent as BasePremiumComponent } from "@bitwarden/angular/vault/components/premium.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-premium",
  templateUrl: "premium.component.html",
})
export class PremiumComponent extends BasePremiumComponent {
  priceString: string;

  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    configService: ConfigService,
    logService: LogService,
    private location: Location,
    private currencyPipe: CurrencyPipe,
    dialogService: DialogService,
    environmentService: EnvironmentService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    super(
      i18nService,
      platformUtilsService,
      apiService,
      configService,
      logService,
      dialogService,
      environmentService,
      billingAccountProfileStateService,
    );

    // Support old price string. Can be removed in future once all translations are properly updated.
    const thePrice = this.currencyPipe.transform(this.price, "$");
    // Safari extension crashes due to $1 appearing in the price string ($10.00). Escape the $ to fix.
    const formattedPrice = this.platformUtilsService.isSafari()
      ? thePrice.replace("$", "$$$")
      : thePrice;
    this.priceString = i18nService.t("premiumPrice", formattedPrice);
    if (this.priceString.indexOf("%price%") > -1) {
      this.priceString = this.priceString.replace("%price%", thePrice);
    }
  }

  goBack() {
    this.location.back();
  }
}
