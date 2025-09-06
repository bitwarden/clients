// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

interface AddOrganizationDialogData {
  providerId: string;
  organizations: Organization[];
}

@Component({
  templateUrl: "add-organization.component.html",
  standalone: false,
})
export class AddOrganizationComponent implements OnInit {
  protected provider: Provider;
  protected loading = true;

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: AddOrganizationDialogData,
    private providerService: ProviderService,
    private webProviderService: WebProviderService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private validationService: ValidationService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    if (this.data.providerId == null) {
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.provider = await this.providerService.get(this.data.providerId, userId);

    this.loading = false;
  }

  add(organization: Organization) {
    return async () => {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: organization.name,
        content: {
          key: "addOrganizationConfirmation",
          placeholders: [organization.name, this.provider.name],
        },
        type: "warning",
      });

      if (!confirmed) {
        return false;
      }

      try {
        await this.webProviderService.addOrganizationToProvider(
          this.data.providerId,
          organization.id,
        );
      } catch (e) {
        this.validationService.showError(e);
        return;
      }

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("organizationJoinedProvider"),
      });

      this.dialogRef.close(true);
    };
  }

  static open(dialogService: DialogService, data: AddOrganizationDialogData) {
    return dialogService.open<boolean, AddOrganizationDialogData>(AddOrganizationComponent, {
      data,
    });
  }
}
