// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { StorageRequest } from "@bitwarden/common/models/request/storage.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

export interface AdjustStorageDialogParams {
  price: number;
  cadence: "month" | "year";
  type: "Add" | "Remove";
  organizationId?: string;
}

export enum AdjustStorageDialogResultType {
  Submitted = "submitted",
  Closed = "closed",
}

@Component({
  templateUrl: "./adjust-storage-dialog.component.html",
})
export class AdjustStorageDialogComponent {
  protected formGroup = new FormGroup({
    storage: new FormControl<number>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(99),
    ]),
  });

  protected organizationId?: string;
  protected price: number;
  protected cadence: "month" | "year";

  protected title: string;
  protected body: string;
  protected storageFieldLabel: string;

  protected ResultType = AdjustStorageDialogResultType;

  constructor(
    private apiService: ApiService,
    @Inject(DIALOG_DATA) protected dialogParams: AdjustStorageDialogParams,
    private dialogRef: DialogRef<AdjustStorageDialogResultType>,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private toastService: ToastService,
  ) {
    this.price = this.dialogParams.price;
    this.cadence = this.dialogParams.cadence;
    this.organizationId = this.dialogParams.organizationId;
    switch (this.dialogParams.type) {
      case "Add":
        this.title = this.i18nService.t("addStorage");
        this.body = this.i18nService.t("storageAddNote");
        this.storageFieldLabel = this.i18nService.t("gbStorageAdd");
        break;
      case "Remove":
        this.title = this.i18nService.t("removeStorage");
        this.body = this.i18nService.t("storageRemoveNote");
        this.storageFieldLabel = this.i18nService.t("gbStorageRemove");
        break;
    }
  }

  submit = async () => {
    const request = new StorageRequest();
    switch (this.dialogParams.type) {
      case "Add":
        request.storageGbAdjustment = this.formGroup.value.storage;
        break;
      case "Remove":
        request.storageGbAdjustment = this.formGroup.value.storage * -1;
        break;
    }

    if (this.organizationId) {
      await this.organizationApiService.updateStorage(this.organizationId, request);
    } else {
      await this.apiService.postAccountStorage(request);
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("adjustedStorage", request.storageGbAdjustment.toString()),
    });

    this.dialogRef.close(this.ResultType.Submitted);
  };

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<AdjustStorageDialogParams>,
  ) =>
    dialogService.open<AdjustStorageDialogResultType>(AdjustStorageDialogComponent, dialogConfig);
}
