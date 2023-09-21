import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";

import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, TableDataSource } from "@bitwarden/components";

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
    private organizationUserService: OrganizationUserService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.dataSource.data = this.data.users;
  }

  submit = async () => {
    await this.organizationUserService.putOrganizationUserBulkEnableSecretsManager(
      this.data.orgId,
      this.dataSource.data.map((u) => u.id)
    );
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("activatedAccessToSecretsManager")
    );
    this.dialogRef.close();
  };

  static open(dialogService: DialogService, data: BulkEnableSecretsManagerDialogData) {
    return dialogService.open<unknown, BulkEnableSecretsManagerDialogData>(
      BulkEnableSecretsManagerDialogComponent,
      { data }
    );
  }
}
