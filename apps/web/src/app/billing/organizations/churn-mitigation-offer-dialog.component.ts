import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, signal } from "@angular/core";

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
  imports: [BillingSharedModule, CommonModule, ButtonModule, CardComponent, DialogModule],
})
export class ChurnMitigationOfferDialogComponent {
  protected readonly ResultType = ChurnMitigationOfferDialogResultType;

  protected readonly offerRedeemed = signal(false);
  protected readonly loading = signal(false);

  constructor(
    @Inject(DIALOG_DATA) protected readonly params: ChurnMitigationOfferDialogParams,
    private readonly dialogRef: DialogRef<ChurnMitigationOfferDialogResultType>,
    private readonly organizationBillingClient: OrganizationBillingClient,
    private readonly toastService: ToastService,
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
  ) {}

  protected get discountLabel(): string {
    if (this.params.offer.percentOff != null) {
      return `${this.params.offer.percentOff}%`;
    }
    return this.params.offer.name;
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
