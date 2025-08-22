import { Component, Inject, OnInit } from "@angular/core";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AddableOrganizationResponse } from "@bitwarden/common/admin-console/models/response/addable-organization.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { WebProviderService } from "../../../admin-console/providers/services/web-provider.service";

export type AddExistingOrganizationDialogParams = {
  provider: Provider;
};

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum AddExistingOrganizationDialogResultType {
  Closed = "closed",
  Submitted = "submitted",
}

@Component({
  templateUrl: "./add-existing-organization-dialog.component.html",
  standalone: false,
})
export class AddExistingOrganizationDialogComponent implements OnInit {
  protected loading: boolean = true;

  addableOrganizations: AddableOrganizationResponse[] = [];
  selectedOrganization?: AddableOrganizationResponse;

  protected readonly ResultType = AddExistingOrganizationDialogResultType;

  constructor(
    @Inject(DIALOG_DATA) protected dialogParams: AddExistingOrganizationDialogParams,
    private dialogRef: DialogRef<AddExistingOrganizationDialogResultType>,
    private i18nService: I18nService,
    private providerApiService: ProviderApiServiceAbstraction,
    private toastService: ToastService,
    private webProviderService: WebProviderService,
  ) {}

  async ngOnInit() {
    this.addableOrganizations = await this.providerApiService.getProviderAddableOrganizations(
      this.dialogParams.provider.id,
    );
    this.loading = false;
  }

  addExistingOrganization = async (): Promise<void> => {
    if (this.selectedOrganization) {
      await this.webProviderService.addOrganizationToProviderVNext(
        this.dialogParams.provider.id,
        this.selectedOrganization.id,
      );

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("addedExistingOrganization"),
      });

      this.dialogRef.close(this.ResultType.Submitted);
    }
  };

  selectOrganization(organizationId: string) {
    this.selectedOrganization = this.addableOrganizations.find(
      (organization) => organization.id === organizationId,
    );
  }

  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<
      AddExistingOrganizationDialogParams,
      DialogRef<AddExistingOrganizationDialogResultType>
    >,
  ) =>
    dialogService.open<
      AddExistingOrganizationDialogResultType,
      AddExistingOrganizationDialogParams
    >(AddExistingOrganizationDialogComponent, dialogConfig);
}
