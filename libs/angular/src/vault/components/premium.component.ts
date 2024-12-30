// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OnInit, Directive } from "@angular/core";
import { firstValueFrom, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

@Directive()
export class PremiumComponent implements OnInit {
  isPremium$: Observable<boolean>;
  price = 10;
  refreshPromise: Promise<any>;
  cloudWebVaultUrl: string;
  extensionRefreshFlagEnabled: boolean;

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected apiService: ApiService,
    protected configService: ConfigService,
    private logService: LogService,
    protected dialogService: DialogService,
    private environmentService: EnvironmentService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    this.isPremium$ = billingAccountProfileStateService.hasPremiumFromAnySource$;
  }

  async ngOnInit() {
    this.cloudWebVaultUrl = await firstValueFrom(this.environmentService.cloudWebVaultUrl$);
    this.extensionRefreshFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.ExtensionRefresh,
    );
  }

  async refresh() {
    try {
      this.refreshPromise = this.apiService.refreshIdentityToken();
      await this.refreshPromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("refreshComplete"));
    } catch (e) {
      this.logService.error(e);
    }
  }

  async purchase() {
    const dialogOpts: SimpleDialogOptions = {
      title: { key: "continueToBitwardenDotCom" },
      content: {
        key: this.extensionRefreshFlagEnabled ? "premiumPurchaseAlertV2" : "premiumPurchaseAlert",
      },
      type: "info",
    };

    if (this.extensionRefreshFlagEnabled) {
      dialogOpts.acceptButtonText = { key: "continue" };
      dialogOpts.cancelButtonText = { key: "close" };
    }

    const confirmed = await this.dialogService.openSimpleDialog(dialogOpts);

    if (confirmed) {
      this.platformUtilsService.launchUri(
        `${this.cloudWebVaultUrl}/#/settings/subscription/premium`,
      );
    }
  }

  async manage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "premiumManage" },
      content: { key: "premiumManageAlert" },
      type: "info",
    });

    if (confirmed) {
      this.platformUtilsService.launchUri(
        `${this.cloudWebVaultUrl}/#/settings/subscription/premium`,
      );
    }
  }
}
