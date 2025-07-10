// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, CurrencyPipe, Location } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { PremiumComponent as BasePremiumComponent } from "@bitwarden/angular/billing/components/premium.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CardComponent,
  DialogService,
  ItemModule,
  SectionComponent,
  ToastService,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-premium",
  templateUrl: "premium-v2.component.html",
  imports: [
    ButtonModule,
    CardComponent,
    CommonModule,
    ItemModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    RouterModule,
    SectionComponent,
  ],
})
export class PremiumV2Component extends BasePremiumComponent {
  priceString: string;

  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    logService: LogService,
    private location: Location,
    private currencyPipe: CurrencyPipe,
    dialogService: DialogService,
    environmentService: EnvironmentService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    toastService: ToastService,
    accountService: AccountService,
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
    );

    // Support old price string. Can be removed in future once all translations are properly updated.
    const thePrice = this.currencyPipe.transform(this.price, "$");
    // Safari extension crashes due to $1 appearing in the price string ($10.00). Escape the $ to fix.
    const formattedPrice = this.platformUtilsService.isSafari()
      ? thePrice.replace("$", "$$$")
      : thePrice;
    this.priceString = i18nService.t("premiumPriceV2", formattedPrice);
    if (this.priceString.indexOf("%price%") > -1) {
      this.priceString = this.priceString.replace("%price%", thePrice);
    }
  }

  goBack() {
    this.location.back();
  }
}
