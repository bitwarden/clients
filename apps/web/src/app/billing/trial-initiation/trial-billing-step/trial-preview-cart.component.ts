import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from "@angular/core";

import { SubscriptionDiscount } from "@bitwarden/common/billing/models/response/subscription-discount.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SpinnerComponent } from "@bitwarden/components";
import { CartSummaryComponent } from "@bitwarden/pricing";
import { BillingAddressControls } from "@bitwarden/web-vault/app/billing/payment/components";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import {
  Cadence,
  Trial,
  TrialBillingStepService,
} from "@bitwarden/web-vault/app/billing/trial-initiation/trial-billing-step/trial-billing-step.service";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

type PreviewParams = {
  trial: Trial;
  cadence: Cadence;
  billingAddress: BillingAddressControls;
  coupons: string[];
};

@Component({
  selector: "app-trial-preview-cart",
  templateUrl: "./trial-preview-cart.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule, CartSummaryComponent, SpinnerComponent],
})
export class TrialPreviewCartComponent {
  readonly trial = input.required<Trial>();
  readonly cadence = input.required<Cadence>();
  readonly billingAddress = input.required<BillingAddressControls>();
  readonly eligibleDiscounts = input.required<SubscriptionDiscount[]>();

  private readonly i18nService = inject(I18nService);
  private readonly billingNotificationService = inject(BillingNotificationService);
  private readonly trialBillingStepService = inject(TrialBillingStepService);

  private readonly previewParams = computed<PreviewParams | undefined>(
    () => {
      const trial = this.trial();
      const billingAddress = this.billingAddress();
      if (trial.length !== 0 || !billingAddress?.country || !billingAddress?.postalCode) {
        return undefined;
      }
      return {
        trial,
        cadence: this.cadence(),
        billingAddress,
        coupons: this.eligibleDiscounts().map((d) => d.stripeCouponId),
      };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected readonly preview = resource({
    params: this.previewParams,
    loader: async ({ params }) => {
      try {
        return await this.trialBillingStepService.previewPurchase(
          params.trial,
          params.cadence,
          params.billingAddress,
          params.coupons,
        );
      } catch (error) {
        this.billingNotificationService.showError(
          this.i18nService.t(this.getPreviewErrorMessageKey(error)),
        );
        throw error;
      }
    },
  });

  private readonly getPreviewErrorMessageKey = (error: unknown): string => {
    const response =
      error instanceof ErrorResponse ? error : (error as { cause?: unknown } | undefined)?.cause;
    return response instanceof ErrorResponse && response.statusCode === 400
      ? "billingPreviewInvalidAddressError"
      : "invoicePreviewErrorMessage";
  };

  /** The preview has a resolved cart to submit on — not loading, not errored, has a value. */
  readonly canSubmit = computed(
    () => !this.preview.isLoading() && this.preview.error() == null && this.preview.hasValue(),
  );

  protected readonly previewErrorMessageKey = computed(() =>
    this.getPreviewErrorMessageKey(this.preview.error()),
  );

  protected readonly previewRetryable = computed(
    () => this.previewErrorMessageKey() !== "billingPreviewInvalidAddressError",
  );
}
