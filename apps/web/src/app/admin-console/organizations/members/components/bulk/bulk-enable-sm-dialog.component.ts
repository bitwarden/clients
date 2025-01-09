// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, TableDataSource, ToastService } from "@bitwarden/components";

import { OrganizationUserView } from "../../../core";

export type BulkEnableSecretsManagerDialogData = {
  orgId: string;
  users: OrganizationUserView[];
};

@Component({
  templateUrl: `bulk-enable-sm-dialog.component.html`,
})
export class BulkEnableSecretsManagerDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<OrganizationUserView>();
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: BulkEnableSecretsManagerDialogData,
    private organizationUserApiService: OrganizationUserApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.dataSource.data = this.data.users;
  }

  submit = async () => {
    await this.organizationUserApiService.putOrganizationUserBulkEnableSecretsManager(
      this.data.orgId,
      this.dataSource.data.map((u) => u.id),
    );
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("activatedAccessToSecretsManager"),
    });
    this.dialogRef.close();
  };

  static open(dialogService: DialogService, data: BulkEnableSecretsManagerDialogData) {
    return dialogService.open<unknown, BulkEnableSecretsManagerDialogData>(
      BulkEnableSecretsManagerDialogComponent,
      { data },
    );
  }
}
