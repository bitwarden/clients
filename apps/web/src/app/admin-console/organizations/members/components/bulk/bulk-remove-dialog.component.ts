// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogConfig, DialogService } from "@bitwarden/components";

import { BaseBulkRemoveComponent } from "./base-bulk-remove.component";
import { BulkUserDetails } from "./bulk-status.component";

type BulkRemoveDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl: "bulk-remove-dialog.component.html",
  standalone: false,
})
export class BulkRemoveDialogComponent extends BaseBulkRemoveComponent {
  organizationId: string;
  users: BulkUserDetails[];

  constructor(
    @Inject(DIALOG_DATA) protected dialogParams: BulkRemoveDialogParams,
    protected i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
  ) {
    super(i18nService);
    this.organizationId = dialogParams.organizationId;
    this.users = dialogParams.users;
    this.showNoMasterPasswordWarning = this.users.some(
      (u) => u.status > OrganizationUserStatusType.Invited && u.hasMasterPassword === false,
    );
  }

  protected deleteUsers = (): Promise<ListResponse<OrganizationUserBulkResponse>> =>
    this.organizationUserApiService.removeManyOrganizationUsers(
      this.organizationId,
      this.users.map((user) => user.id),
    );

  protected get removeUsersWarning() {
    return this.i18nService.t("removeOrgUsersConfirmation");
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkRemoveDialogParams>) {
    return dialogService.open(BulkRemoveDialogComponent, config);
  }
}
