// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DIALOG_DATA, BitValidators, ToastService } from "@bitwarden/components";

import { ServiceAccountView } from "../../models/view/service-account.view";
import { ServiceAccountService } from "../service-account.service";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum OperationType {
  Add,
  Edit,
}

export interface ServiceAccountOperation {
  organizationId: string;
  serviceAccountId?: string;
  operation: OperationType;
  organizationEnabled: boolean;
}

@Component({
  templateUrl: "./service-account-dialog.component.html",
  standalone: false,
})
export class ServiceAccountDialogComponent implements OnInit {
  protected formGroup = new FormGroup(
    {
      name: new FormControl("", {
        validators: [Validators.required, Validators.maxLength(500), BitValidators.trimValidator],
        updateOn: "submit",
      }),
    },
    {},
  );

  protected loading = false;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: ServiceAccountOperation,
    private serviceAccountService: ServiceAccountService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  async ngOnInit() {
    if (this.data.operation == OperationType.Edit) {
      await this.loadData();
    }
  }

  async loadData() {
    this.loading = true;
    const serviceAccount: ServiceAccountView =
      await this.serviceAccountService.getByServiceAccountId(
        this.data.serviceAccountId,
        this.data.organizationId,
      );
    this.formGroup.patchValue({ name: serviceAccount.name });
    this.loading = false;
  }

  submit = async () => {
    if (!this.data.organizationEnabled) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("machineAccountsCannotCreate"),
      });
      return;
    }

    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const serviceAccountView = this.getServiceAccountView();
    let serviceAccountMessage: string;

    if (this.data.operation == OperationType.Add) {
      const newServiceAccount = await this.serviceAccountService.create(
        this.data.organizationId,
        serviceAccountView,
      );
      serviceAccountMessage = this.i18nService.t("machineAccountCreated");
      await this.router.navigate([
        "sm",
        this.data.organizationId,
        "machine-accounts",
        newServiceAccount.id,
      ]);
    } else {
      await this.serviceAccountService.update(
        this.data.serviceAccountId,
        this.data.organizationId,
        serviceAccountView,
      );
      serviceAccountMessage = this.i18nService.t("machineAccountUpdated");
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: serviceAccountMessage,
    });
    this.dialogRef.close();
  };

  private getServiceAccountView() {
    const serviceAccountView = new ServiceAccountView();
    serviceAccountView.organizationId = this.data.organizationId;
    serviceAccountView.name = this.formGroup.value.name;
    return serviceAccountView;
  }

  get title() {
    return this.data.operation === OperationType.Add ? "newMachineAccount" : "editMachineAccount";
  }
}
