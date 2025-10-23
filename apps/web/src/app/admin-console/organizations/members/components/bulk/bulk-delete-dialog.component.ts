// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogConfig, DialogService } from "@bitwarden/components";

import { DeleteManagedMemberWarningService } from "../../services/delete-managed-member/delete-managed-member-warning.service";

import { BulkUserDetails } from "./bulk-status.component";

type BulkDeleteDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "bulk-delete-dialog.component.html",
  standalone: false,
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
    private deleteManagedMemberWarningService: DeleteManagedMemberWarningService,
  ) {
    this.organizationId = dialogParams.organizationId;
    this.users = dialogParams.users;
  }

  async submit() {
    await this.deleteManagedMemberWarningService.acknowledgeWarning(this.organizationId);

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
