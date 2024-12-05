// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { forwardRef, Component, Inject, ViewChild } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { UpdatePaymentMethodRequest } from "@bitwarden/common/billing/models/request/update-payment-method.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { TaxInfoComponent } from "../";
import { PaymentV2Component } from "../payment/payment-v2.component";

export interface AdjustPaymentDialogV2Params {
  initialPaymentMethod?: PaymentMethodType;
  organizationId?: string;
}

export enum AdjustPaymentDialogV2ResultType {
  Closed = "closed",
  Submitted = "submitted",
}

@Component({
  templateUrl: "./adjust-payment-dialog-v2.component.html",
})
export class AdjustPaymentDialogV2Component {
  @ViewChild(PaymentV2Component) paymentComponent: PaymentV2Component;
  @ViewChild(forwardRef(() => TaxInfoComponent)) taxInfoComponent: TaxInfoComponent;

  protected readonly PaymentMethodType = PaymentMethodType;
  protected readonly ResultType = AdjustPaymentDialogV2ResultType;

  protected dialogHeader: string;
  protected initialPaymentMethod: PaymentMethodType;
  protected organizationId?: string;

  constructor(
    private apiService: ApiService,
    private billingApiService: BillingApiServiceAbstraction,
    @Inject(DIALOG_DATA) protected dialogParams: AdjustPaymentDialogV2Params,
    private dialogRef: DialogRef<AdjustPaymentDialogV2ResultType>,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {
    const key = this.dialogParams.initialPaymentMethod ? "changePaymentMethod" : "addPaymentMethod";
    this.dialogHeader = this.i18nService.t(key);
    this.initialPaymentMethod = this.dialogParams.initialPaymentMethod ?? PaymentMethodType.Card;
    this.organizationId = this.dialogParams.organizationId;
  }

  onCountryChanged = () => {
    if (this.taxInfoComponent.taxInfo.country === "US") {
      this.paymentComponent.showBankAccount = !!this.organizationId;
    } else {
      this.paymentComponent.showBankAccount = false;
      if (this.paymentComponent.selected === PaymentMethodType.BankAccount) {
        this.paymentComponent.select(PaymentMethodType.Card);
      }
    }
  };

  submit = async (): Promise<void> => {
    this.taxInfoComponent.taxFormGroup.updateValueAndValidity();
    this.taxInfoComponent.taxFormGroup.markAllAsTouched();
    if (this.taxInfoComponent.taxFormGroup.invalid) {
      return;
    }

    if (!this.organizationId) {
      await this.updatePremiumUserPaymentMethod();
    } else {
      await this.updateOrganizationPaymentMethod();
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("updatedPaymentMethod"),
    });

    this.dialogRef.close(AdjustPaymentDialogV2ResultType.Submitted);
  };

  private updateOrganizationPaymentMethod = async () => {
    const paymentSource = await this.paymentComponent.tokenize();

    const request = new UpdatePaymentMethodRequest();
    request.paymentSource = paymentSource;
    request.taxInformation = {
      country: this.taxInfoComponent.country,
      postalCode: this.taxInfoComponent.postalCode,
      taxId: this.taxInfoComponent.taxId,
      line1: this.taxInfoComponent.line1,
      line2: this.taxInfoComponent.line2,
      city: this.taxInfoComponent.city,
      state: this.taxInfoComponent.state,
    };

    await this.billingApiService.updateOrganizationPaymentMethod(this.organizationId, request);
  };

  private updatePremiumUserPaymentMethod = async () => {
    const { type, token } = await this.paymentComponent.tokenize();

    const request = new PaymentRequest();
    request.paymentMethodType = type;
    request.paymentToken = token;
    request.country = this.taxInfoComponent.country;
    request.postalCode = this.taxInfoComponent.postalCode;
    await this.apiService.postAccountPayment(request);
  };

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<AdjustPaymentDialogV2Params>,
  ) =>
    dialogService.open<AdjustPaymentDialogV2ResultType>(
      AdjustPaymentDialogV2Component,
      dialogConfig,
    );
}
