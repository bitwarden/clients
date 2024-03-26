import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, ViewChild } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PaymentResponse } from "@bitwarden/common/billing/models/response/payment.response";
import { StorageRequest } from "@bitwarden/common/models/request/storage.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { PaymentComponent } from "./payment.component";

export interface AdjustStorageDialogData {
  storageGbPrice: number;
  add: boolean;
  organizationId?: string;
  interval?: string;
}

export enum AdjustStorageDialogResult {
  Adjusted = "adjusted",
  Cancelled = "cancelled",
}

@Component({
  templateUrl: "adjust-storage.component.html",
})
export class AdjustStorageComponent {
  storageGbPrice: number;
  add: boolean;
  organizationId: string;
  interval: string;

  @ViewChild(PaymentComponent, { static: true }) paymentComponent: PaymentComponent;

  protected DialogResult = AdjustStorageDialogResult;
  protected formGroup = new FormGroup({
    storageAdjustment: new FormControl(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(99),
    ]),
  });

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: AdjustStorageDialogData,
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {
    this.storageGbPrice = data.storageGbPrice;
    this.add = data.add;
    this.organizationId = data.organizationId;
    this.interval = data.interval || "year";
  }

  submit = async () => {
    const request = new StorageRequest();
    request.storageGbAdjustment = this.formGroup.value.storageAdjustment;
    if (!this.add) {
      request.storageGbAdjustment *= -1;
    }

    let paymentFailed = false;
    const action = async () => {
      let response: Promise<PaymentResponse>;
      if (this.organizationId == null) {
        response = this.apiService.postAccountStorage(request);
      } else {
        response = this.organizationApiService.updateStorage(this.organizationId, request);
      }
      const result = await response;
      if (result != null && result.paymentIntentClientSecret != null) {
        try {
          await this.paymentComponent.handleStripeCardPayment(
            result.paymentIntentClientSecret,
            null,
          );
        } catch {
          paymentFailed = true;
        }
      }
    };
    await action();
    this.dialogRef.close(AdjustStorageDialogResult.Adjusted);
    if (paymentFailed) {
      this.platformUtilsService.showToast(
        "warning",
        null,
        this.i18nService.t("couldNotChargeCardPayInvoice"),
        { timeout: 10000 },
      );
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["../billing"], { relativeTo: this.activatedRoute });
    } else {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("adjustedStorage", request.storageGbAdjustment.toString()),
      );
    }
  };

  get adjustedStorageTotal(): number {
    return this.storageGbPrice * this.formGroup.value.storageAdjustment;
  }
}

/**
 * Strongly typed helper to open an AdjustStorageDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openAdjustStorageDialog(
  dialogService: DialogService,
  config: DialogConfig<AdjustStorageDialogData>,
) {
  return dialogService.open<AdjustStorageDialogResult>(AdjustStorageComponent, config);
}
