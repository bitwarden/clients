import { CommonModule, CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, inject, signal } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  CardComponent,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { ChurnMitigationOfferResponseModel, OrganizationBillingClient } from "../clients";
import { BillingSharedModule } from "../shared/billing-shared.module";

export type ChurnMitigationOfferDialogParams = {
  organizationId: OrganizationId;
  offer: ChurnMitigationOfferResponseModel;
  /** Subscription period-end date, shown as the access-end date if the user cancels. */
  accessEndDate: string | null;
  /** Organization plan name displayed in the success state. */
  planName: string;
  /** Next charge date shown in the success state after the offer is applied. */
  nextChargeDate: string | null;
  /** Whether the subscription bills annually; drives interval-aware discount copy. */
  isAnnual: boolean;
};

export const ChurnMitigationOfferDialogResultType = Object.freeze({
  Accepted: "accepted",
  Declined: "declined",
  Closed: "closed",
} as const);

export type ChurnMitigationOfferDialogResultType =
  (typeof ChurnMitigationOfferDialogResultType)[keyof typeof ChurnMitigationOfferDialogResultType];

@Component({
  templateUrl: "./churn-mitigation-offer-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CurrencyPipe],
  imports: [BillingSharedModule, CommonModule, ButtonModule, CardComponent, DialogModule],
})
export class ChurnMitigationOfferDialogComponent {
  protected readonly ResultType = ChurnMitigationOfferDialogResultType;

  protected readonly offerRedeemed = signal(false);
  protected readonly loading = signal(false);

  private readonly currencyPipe = inject(CurrencyPipe);

  constructor(
    @Inject(DIALOG_DATA) protected readonly params: ChurnMitigationOfferDialogParams,
    private readonly dialogRef: DialogRef<ChurnMitigationOfferDialogResultType>,
    private readonly organizationBillingClient: OrganizationBillingClient,
    private readonly toastService: ToastService,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
  ) {}

  protected get discountLabel(): string {
    const offer = this.params.offer;
    if (offer.percentOff != null) {
      return `${offer.percentOff}%`;
    }
    if (offer.amountOff != null) {
      return this.currencyPipe.transform(offer.amountOff, "$", "symbol", "1.2-2") ?? offer.name;
    }
    return offer.name;
  }

  protected get durationDescription(): string {
    const count = this.durationCount;
    return count === 1 ? this.durationUnit : `${count} ${this.durationUnit}`;
  }

  protected get durationLength(): string {
    return this.durationCount.toString();
  }

  protected get durationUnit(): string {
    return this.i18nService.t(this.durationUnitKey);
  }

  /** True when the offer is a fixed amount that applies to each billing period (repeating). */
  protected get isRecurringAmount(): boolean {
    return this.params.offer.amountOff != null && this.params.offer.duration === "repeating";
  }

  /** Localized singular billing-interval unit ("year"/"month") for per-period discount copy. */
  protected get billingIntervalUnit(): string {
    return this.i18nService.t(this.params.isAnnual ? "year" : "month");
  }

  /**
   * Per-interval discount label for the summary card, e.g. "$15.00/month".
   * The i18n pipe accepts at most three positional args, so the amount and interval
   * are pre-composed here to leave room for the length + unit on the card key.
   */
  protected get discountLabelPerInterval(): string {
    return `${this.discountLabel}/${this.billingIntervalUnit}`;
  }

  /** Number of whole years or months the discount covers (years when divisible by 12). */
  private get durationCount(): number {
    const months = this.params.offer.durationInMonths;
    if (months == null) {
      return 1;
    }
    return months % 12 === 0 ? months / 12 : months;
  }

  /** i18n key for the duration unit, pluralized to match {@link durationCount}. */
  private get durationUnitKey(): "year" | "years" | "month" | "months" {
    const months = this.params.offer.durationInMonths;
    if (months == null) {
      // `once`: covers a single billing period → use the subscription interval.
      return this.params.isAnnual ? "year" : "month";
    }
    const isYears = months % 12 === 0;
    if (isYears) {
      return this.durationCount === 1 ? "year" : "years";
    }
    return this.durationCount === 1 ? "month" : "months";
  }

  readonly acceptOffer = async () => {
    this.loading.set(true);
    try {
      await this.organizationBillingClient.redeemChurnOffer(this.params.organizationId);
      this.offerRedeemed.set(true);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("unexpectedError"),
      });
    } finally {
      this.loading.set(false);
    }
  };

  readonly closeAfterAccept = () => {
    void this.dialogRef.close(this.ResultType.Accepted);
  };

  readonly decline = () => {
    void this.dialogRef.close(this.ResultType.Declined);
  };

  static readonly open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<ChurnMitigationOfferDialogParams>,
  ) =>
    dialogService.open<ChurnMitigationOfferDialogResultType, ChurnMitigationOfferDialogParams>(
      ChurnMitigationOfferDialogComponent,
      dialogConfig,
    );
}
