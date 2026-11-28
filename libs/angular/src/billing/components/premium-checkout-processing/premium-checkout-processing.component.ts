import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  IconModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type PremiumCheckoutProcessingDialogData = { featureNameKey: string };

@Component({
  selector: "billing-premium-checkout-processing",
  templateUrl: "./premium-checkout-processing.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, IconModule, I18nPipe],
})
export class PremiumCheckoutProcessingComponent {
  private readonly data = inject<PremiumCheckoutProcessingDialogData>(DIALOG_DATA);
  private readonly i18nService = inject(I18nService);

  protected readonly body = this.i18nService.t(
    "confirmingYourUpgradeDesc",
    this.i18nService.t(this.data.featureNameKey),
  );

  static open(dialogService: DialogService, data: PremiumCheckoutProcessingDialogData): DialogRef {
    return dialogService.open(PremiumCheckoutProcessingComponent, {
      data,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
