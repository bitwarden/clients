import { CurrencyPipe, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { catchError, EMPTY, map, Observable, of } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import {
  PremiumUpgradeNudgeImage,
  PremiumUpgradeNudgeOptions,
} from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  IconModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

import { DarkImageSourceDirective } from "../../../directives/dark-image-source.directive";
import { PremiumBadgeComponent } from "../premium-badge/premium-badge.component";

type NudgeImage = { light: string; dark: string; width: number; height: number };

const NUDGE_IMAGES: Record<PremiumUpgradeNudgeImage, NudgeImage> = {
  totp: {
    light: "images/premium/premium-nudge-totp-light.png",
    dark: "images/premium/premium-nudge-totp-dark.png",
    width: 339,
    height: 138,
  },
};

export type PremiumUpgradeNudgeDialogData = {
  options: PremiumUpgradeNudgeOptions;
  upgrade: () => Promise<void>;
};

class NoopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  readonly upgradeConfirmed$: Observable<boolean> = EMPTY;

  promptForPremium(): Promise<void> {
    return Promise.resolve();
  }
}

@Component({
  selector: "billing-premium-upgrade-nudge",
  templateUrl: "./premium-upgrade-nudge.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    NgTemplateOutlet,
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    IconModule,
    TypographyModule,
    I18nPipe,
    DarkImageSourceDirective,
    PremiumBadgeComponent,
  ],
  providers: [
    safeProvider({
      provide: PremiumUpgradePromptService,
      useClass: NoopPremiumUpgradePromptService,
      deps: [],
    }),
  ],
})
export class PremiumUpgradeNudgeComponent {
  private readonly data = inject<PremiumUpgradeNudgeDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly subscriptionPricingService = inject(SubscriptionPricingServiceAbstraction);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly options = this.data.options;
  protected readonly image = this.options.image ? NUDGE_IMAGES[this.options.image] : undefined;
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
