// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnInit, ViewChild } from "@angular/core";
import { FormGroup } from "@angular/forms";

import { ManageTaxInformationComponent } from "@bitwarden/angular/billing/components";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PaymentMethodType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { TaxInfoResponse } from "@bitwarden/common/billing/models/response/tax-info.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { PaymentComponent } from "../payment/payment.component";

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
export class AdjustPaymentDialogComponent implements OnInit {
  @ViewChild(PaymentComponent, { static: true }) paymentComponent: PaymentComponent;
  @ViewChild(ManageTaxInformationComponent) taxInfoComponent: ManageTaxInformationComponent;

  organizationId: string;
  currentType: PaymentMethodType;
  paymentMethodType = PaymentMethodType;

  protected DialogResult = AdjustPaymentDialogResult;
  protected formGroup = new FormGroup({});

  protected taxInformation: TaxInformation;

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

  ngOnInit(): void {
    if (this.organizationId) {
      this.organizationApiService
        .getTaxInfo(this.organizationId)
        .then((response: TaxInfoResponse) => {
          this.taxInformation = TaxInformation.from(response);
        })
        .catch(() => {
          this.taxInformation = new TaxInformation();
        });
    } else {
      this.apiService
        .getTaxInfo()
        .then((response: TaxInfoResponse) => {
          this.taxInformation = TaxInformation.from(response);
        })
        .catch(() => {
          this.taxInformation = new TaxInformation();
        });
    }
  }

  submit = async () => {
    if (!this.taxInfoComponent?.validate()) {
      return;
    }

    const request = new PaymentRequest();
    const response = this.paymentComponent.createPaymentToken().then((result) => {
      request.paymentToken = result[0];
      request.paymentMethodType = result[1];
      request.postalCode = this.taxInformation?.postalCode;
      request.country = this.taxInformation?.country;
      request.taxId = this.taxInformation?.taxId;
      if (this.organizationId == null) {
        return this.apiService.postAccountPayment(request);
      } else {
        request.taxId = this.taxInformation?.taxId;
        request.state = this.taxInformation?.state;
        request.line1 = this.taxInformation?.line1;
        request.line2 = this.taxInformation?.line2;
        request.city = this.taxInformation?.city;
        request.state = this.taxInformation?.state;
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

  taxInformationChanged(event: TaxInformation) {
    this.taxInformation = event;
    if (event.country === "US") {
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
