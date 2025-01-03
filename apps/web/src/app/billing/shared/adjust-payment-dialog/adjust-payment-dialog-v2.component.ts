// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, forwardRef, Inject, OnInit, ViewChild } from "@angular/core";

import { ManageTaxInformationComponent } from "@bitwarden/angular/billing/components";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PaymentMethodType, ProductTierType } from "@bitwarden/common/billing/enums";
import { TaxInformation } from "@bitwarden/common/billing/models/domain";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { PaymentRequest } from "@bitwarden/common/billing/models/request/payment.request";
import { UpdatePaymentMethodRequest } from "@bitwarden/common/billing/models/request/update-payment-method.request";
import { TaxInfoResponse } from "@bitwarden/common/billing/models/response/tax-info.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { PaymentV2Component } from "../payment/payment-v2.component";

export interface AdjustPaymentDialogV2Params {
  initialPaymentMethod?: PaymentMethodType;
  organizationId?: string;
  productTier?: ProductTierType;
}

export enum AdjustPaymentDialogV2ResultType {
  Closed = "closed",
  Submitted = "submitted",
}

@Component({
  templateUrl: "./adjust-payment-dialog-v2.component.html",
})
export class AdjustPaymentDialogV2Component implements OnInit {
  @ViewChild(PaymentV2Component) paymentComponent: PaymentV2Component;
  @ViewChild(forwardRef(() => ManageTaxInformationComponent))
  taxInfoComponent: ManageTaxInformationComponent;

  protected readonly PaymentMethodType = PaymentMethodType;
  protected readonly ResultType = AdjustPaymentDialogV2ResultType;

  protected dialogHeader: string;
  protected initialPaymentMethod: PaymentMethodType;
  protected organizationId?: string;
  protected productTier?: ProductTierType;

  protected taxInformation: TaxInformation;

  constructor(
    private apiService: ApiService,
    private billingApiService: BillingApiServiceAbstraction,
    private organizationApiService: OrganizationApiServiceAbstraction,
    @Inject(DIALOG_DATA) protected dialogParams: AdjustPaymentDialogV2Params,
    private dialogRef: DialogRef<AdjustPaymentDialogV2ResultType>,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {
    const key = this.dialogParams.initialPaymentMethod ? "changePaymentMethod" : "addPaymentMethod";
    this.dialogHeader = this.i18nService.t(key);
    this.initialPaymentMethod = this.dialogParams.initialPaymentMethod ?? PaymentMethodType.Card;
    this.organizationId = this.dialogParams.organizationId;
    this.productTier = this.dialogParams.productTier;
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

  taxInformationChanged(event: TaxInformation) {
    this.taxInformation = event;
    if (event.country === "US") {
      this.paymentComponent.showBankAccount = !!this.organizationId;
    } else {
      this.paymentComponent.showBankAccount = false;
      if (this.paymentComponent.selected === PaymentMethodType.BankAccount) {
        this.paymentComponent.select(PaymentMethodType.Card);
      }
    }
  }

  submit = async (): Promise<void> => {
    if (!this.taxInfoComponent.validate()) {
      return;
    }

    try {
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
    } catch (error) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t(error.message) || error.message,
      });
    }
  };

  private updateOrganizationPaymentMethod = async () => {
    const paymentSource = await this.paymentComponent.tokenize();

    const request = new UpdatePaymentMethodRequest();
    request.paymentSource = paymentSource;
    request.taxInformation = ExpandedTaxInfoUpdateRequest.From(this.taxInformation);

    await this.billingApiService.updateOrganizationPaymentMethod(this.organizationId, request);
  };

  protected get showTaxIdField(): boolean {
    if (!this.organizationId) {
      return false;
    }

    switch (this.productTier) {
      case ProductTierType.Free:
      case ProductTierType.Families:
        return false;
      default:
        return true;
    }
  }

  private updatePremiumUserPaymentMethod = async () => {
    const { type, token } = await this.paymentComponent.tokenize();

    const request = new PaymentRequest();
    request.paymentMethodType = type;
    request.paymentToken = token;
    request.country = this.taxInformation.country;
    request.postalCode = this.taxInformation.postalCode;
    request.taxId = this.taxInformation.taxId;
    request.state = this.taxInformation.state;
    request.line1 = this.taxInformation.line1;
    request.line2 = this.taxInformation.line2;
    request.city = this.taxInformation.city;
    request.state = this.taxInformation.state;
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
