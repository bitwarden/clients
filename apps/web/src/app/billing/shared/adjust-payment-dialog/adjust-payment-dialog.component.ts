import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, ViewChild } from "@angular/core";
import { FormGroup } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { PaymentComponent } from "../payment/payment.component";
import { TaxInfoComponent } from "../tax-info.component";

export interface AdjustPaymentDialogData {
  organizationId: string;
  currentType: PaymentMethodType;
}

export enum AdjustPaymentDialogResult {
  Adjusted = "adjusted",
  Cancelled = "cancelled",
}

@Component({
  templateUrl: "adjust-payment-dialog.component.html",
})
export class AdjustPaymentDialogComponent {
  @ViewChild(PaymentComponent, { static: true }) paymentComponent: PaymentComponent;
  @ViewChild(TaxInfoComponent, { static: true }) taxInfoComponent: TaxInfoComponent;

  organizationId: string;
  currentType: PaymentMethodType;
  paymentMethodType = PaymentMethodType;

  protected DialogResult = AdjustPaymentDialogResult;
  protected formGroup = new FormGroup({});

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: AdjustPaymentDialogData,
    private apiService: ApiService,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private configService: ConfigService,
    private toastService: ToastService,
  ) {
    this.organizationId = data.organizationId;
    this.currentType = data.currentType;
  }

  submit = async () => {
    if (!this.taxInfoComponent?.taxFormGroup.valid && this.taxInfoComponent?.taxFormGroup.touched) {
      this.taxInfoComponent.taxFormGroup.markAllAsTouched();
      return;
    }
    const request = new PaymentRequest();
    const response = this.paymentComponent.createPaymentToken().then((result) => {
      request.paymentToken = result[0];
      request.paymentMethodType = result[1];
      request.postalCode = this.taxInfoComponent.taxFormGroup?.value.postalCode;
      request.country = this.taxInfoComponent.taxFormGroup?.value.country;
      if (this.organizationId == null) {
        return this.apiService.postAccountPayment(request);
      } else {
        request.taxId = this.taxInfoComponent.taxFormGroup?.value.taxId;
        request.state = this.taxInfoComponent.taxFormGroup?.value.state;
        request.line1 = this.taxInfoComponent.taxFormGroup?.value.line1;
        request.line2 = this.taxInfoComponent.taxFormGroup?.value.line2;
        request.city = this.taxInfoComponent.taxFormGroup?.value.city;
        request.state = this.taxInfoComponent.taxFormGroup?.value.state;
        return this.organizationApiService.updatePayment(this.organizationId, request);
      }
    });
    await response;
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("updatedPaymentMethod"),
    });
    this.dialogRef.close(AdjustPaymentDialogResult.Adjusted);
  };

  changeCountry() {
    if (this.taxInfoComponent.taxInfo.country === "US") {
      this.paymentComponent.hideBank = !this.organizationId;
    } else {
      this.paymentComponent.hideBank = true;
      if (this.paymentComponent.method === PaymentMethodType.BankAccount) {
        this.paymentComponent.method = PaymentMethodType.Card;
        this.paymentComponent.changeMethod();
      }
    }
  }
}

/**
 * Strongly typed helper to open a AdjustPaymentDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openAdjustPaymentDialog(
  dialogService: DialogService,
  config: DialogConfig<AdjustPaymentDialogData>,
) {
  return dialogService.open<AdjustPaymentDialogResult>(AdjustPaymentDialogComponent, config);
}
