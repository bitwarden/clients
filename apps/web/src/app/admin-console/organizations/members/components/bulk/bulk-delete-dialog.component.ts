// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import { BulkUserDetails } from "./bulk-status.component";

type BulkDeleteDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl: "bulk-delete-dialog.component.html",
})
export class BulkDeleteDialogComponent {
  organizationId: string;
  users: BulkUserDetails[];
  loading = false;
  done = false;
  error: string = null;
  statuses = new Map<string, string>();
  userStatusType = OrganizationUserStatusType;

  constructor(
    @Inject(DIALOG_DATA) protected dialogParams: BulkDeleteDialogParams,
    protected i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
  ) {
    this.organizationId = dialogParams.organizationId;
    this.users = dialogParams.users;
  }

  async submit() {
    try {
      this.loading = true;
      this.error = null;

      const response = await this.organizationUserApiService.deleteManyOrganizationUsers(
        this.organizationId,
        this.users.map((user) => user.id),
      );

      response.data.forEach((entry) => {
        this.statuses.set(
          entry.id,
          entry.error ? entry.error : this.i18nService.t("deletedSuccessfully"),
        );
      });

      this.done = true;
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkDeleteDialogParams>) {
    return dialogService.open(BulkDeleteDialogComponent, config);
  }
}
