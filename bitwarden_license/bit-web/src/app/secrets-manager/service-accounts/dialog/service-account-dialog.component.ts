import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { BitValidators } from "@bitwarden/components";

import { ServiceAccountView } from "../../models/view/service-account.view";
import { ServiceAccountService } from "../service-account.service";

export enum OperationType {
  Add,
  Edit,
}

export interface ServiceAccountOperation {
  organizationId: string;
  serviceAccountId?: string;
  operation: OperationType;
}

@Component({
  templateUrl: "./service-account-dialog.component.html",
})
export class ServiceAccountDialogComponent {
  protected formGroup = new FormGroup(
    {
      name: new FormControl("", {
        validators: [Validators.required, Validators.maxLength(500), BitValidators.trimValidator],
        updateOn: "submit",
      }),
    },
    {}
  );

  protected loading = false;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: ServiceAccountOperation,
    private serviceAccountService: ServiceAccountService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {}

  async ngOnInit() {
    if (this.data.operation == OperationType.Edit) {
      this.loadData();
    }
  }

  async loadData() {
    this.loading = true;
    const serviceAccount: ServiceAccountView =
      await this.serviceAccountService.getByServiceAccountId(
        this.data.serviceAccountId,
        this.data.organizationId
      );
    this.formGroup.patchValue({ name: serviceAccount.name });
    this.loading = false;
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const serviceAccountView = this.getServiceAccountView();
    let serviceAccountMessage: string;

    if (this.data.operation == OperationType.Add) {
      await this.serviceAccountService.create(this.data.organizationId, serviceAccountView);
      serviceAccountMessage = this.i18nService.t("serviceAccountCreated");
    } else {
      await this.serviceAccountService.update(
        this.data.serviceAccountId,
        this.data.organizationId,
        serviceAccountView
      );
      serviceAccountMessage = this.i18nService.t("serviceAccountUpdated");
    }

    this.platformUtilsService.showToast("success", null, serviceAccountMessage);
    this.dialogRef.close();
  };

  private getServiceAccountView() {
    const serviceAccountView = new ServiceAccountView();
    serviceAccountView.organizationId = this.data.organizationId;
    serviceAccountView.name = this.formGroup.value.name;
    return serviceAccountView;
  }

  get title() {
    return this.data.operation === OperationType.Add ? "newServiceAccount" : "editServiceAccount";
  }
}
