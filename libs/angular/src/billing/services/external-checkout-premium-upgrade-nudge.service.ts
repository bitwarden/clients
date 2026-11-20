import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import {
  PremiumCheckoutPending,
  PremiumCheckoutPendingService,
} from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import {
  PremiumUpgradeNudgeOptions,
  PremiumUpgradeNudgeService,
} from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { PremiumCheckoutSessionPlatform } from "@bitwarden/common/billing/models/request/premium-checkout-session.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { PremiumUpgradeNudgeComponent } from "../components/premium-upgrade-nudge/premium-upgrade-nudge.component";

@Injectable()
export class ExternalCheckoutPremiumUpgradeNudgeService implements PremiumUpgradeNudgeService {
  private readonly accountService = inject(AccountService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly environmentService = inject(EnvironmentService);
  private readonly configService = inject(ConfigService);
  private readonly billingApiService = inject(BillingApiServiceAbstraction);
  private readonly premiumCheckoutPendingService = inject(PremiumCheckoutPendingService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  async hasPremiumOrShowUpgradeNudge(options: PremiumUpgradeNudgeOptions): Promise<boolean> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const hasPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
    );
    if (hasPremium) {
      return true;
    }

    PremiumUpgradeNudgeComponent.open(this.dialogService, {
      data: {
        options,
        upgrade: () => this.launchCheckout({ featureNameKey: options.checkoutFeatureNameKey }),
      },
      disableClose: this.platformUtilsService.getClientType() === ClientType.Browser,
    });
    return false;
  }

  private async launchCheckout(context: PremiumCheckoutPending): Promise<void> {
    try {
      const environment = await firstValueFrom(this.environmentService.environment$);
      const checkoutFlagEnabled = await this.configService.getFeatureFlag(
        FeatureFlag.PM34515_BrowserDesktopCheckout,
      );
      const bypassSelfHostCheck = await this.configService.getFeatureFlag(
        FeatureFlag.DebugDisableSelfHostPremiumCheck,
      );
      const platform = this.resolveCheckoutPlatform();
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );

      if (
        checkoutFlagEnabled &&
        (environment.isCloud() || bypassSelfHostCheck) &&
        platform != null
      ) {
        const { checkoutSessionUrl } = await this.billingApiService.createPremiumCheckoutSession({
          platform,
        });
        this.platformUtilsService.launchUri(checkoutSessionUrl);

        if (userId != null) {
          try {
            await this.premiumCheckoutPendingService.markCheckoutLaunched(userId, context);
          } catch (error: unknown) {
            this.logService.error("Failed to mark premium checkout as pending", error);
          }
        }
      } else {
        this.platformUtilsService.launchUri(
          environment.getWebVaultUrl() +
            "/#/settings/subscription/premium?callToAction=upgradeToPremium",
        );
      }
    } catch (error: unknown) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("error"),
        message: this.i18nService.t("unexpectedError"),
      });
      this.logService.error("Failed to start premium upgrade", error);
    }
  }

  private resolveCheckoutPlatform(): PremiumCheckoutSessionPlatform | null {
    switch (this.platformUtilsService.getClientType()) {
      case ClientType.Browser:
        return "browser";
      case ClientType.Desktop:
        return "desktop";
      default:
        return null;
    }
  }
}
