import { CurrencyPipe, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { catchError, map, of } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  BadgeModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  IconModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type PremiumUpgradeNudgeDialogData = {
  options: PremiumUpgradeNudgeOptions;
  upgrade: () => Promise<void>;
};

@Component({
  selector: "billing-premium-upgrade-nudge",
  templateUrl: "./premium-upgrade-nudge.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    NgTemplateOutlet,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    DialogModule,
    IconModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class PremiumUpgradeNudgeComponent {
  private readonly data = inject<PremiumUpgradeNudgeDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly subscriptionPricingService = inject(SubscriptionPricingServiceAbstraction);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly options = this.data.options;
  private readonly clientType = this.platformUtilsService.getClientType();
  protected readonly sheet = this.clientType === ClientType.Browser;
  protected readonly externalCheckout =
    this.clientType === ClientType.Browser || this.clientType === ClientType.Desktop;

  protected readonly monthlyPrice = toSignal(
    this.subscriptionPricingService.getPremiumSubscriptionPricingTier$().pipe(
      map(({ passwordManager: { annualPrice } }) =>
        annualPrice != null ? annualPrice / 12 : undefined,
      ),
      catchError(() => of(undefined)),
    ),
  );

  protected readonly upgrade = async (): Promise<void> => {
    await this.data.upgrade();
    await this.dialogRef.close();
  };

  protected dismiss(): void {
    void this.dialogRef.close();
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<PremiumUpgradeNudgeDialogData> & { data: PremiumUpgradeNudgeDialogData },
  ): DialogRef<unknown, PremiumUpgradeNudgeComponent> {
    return dialogService.open(PremiumUpgradeNudgeComponent, config);
  }
}
