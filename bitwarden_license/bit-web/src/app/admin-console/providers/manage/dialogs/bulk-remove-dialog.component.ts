// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";
import { BaseBulkRemoveComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/base-bulk-remove.component";
import { BulkUserDetails } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";

type BulkRemoveDialogParams = {
  providerId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl:
    "../../../../../../../../apps/web/src/app/admin-console/organizations/members/components/bulk/bulk-remove-dialog.component.html",
})
export class BulkRemoveDialogComponent extends BaseBulkRemoveComponent {
  providerId: string;
  users: BulkUserDetails[];

  constructor(
    private apiService: ApiService,
    @Inject(DIALOG_DATA) dialogParams: BulkRemoveDialogParams,
    protected i18nService: I18nService,
  ) {
    super(i18nService);

    this.providerId = dialogParams.providerId;
    this.users = dialogParams.users;
  }

  protected deleteUsers = (): Promise<ListResponse<ProviderUserBulkResponse>> => {
    const request = new ProviderUserBulkRequest(this.users.map((user) => user.id));
    return this.apiService.deleteManyProviderUsers(this.providerId, request);
  };

  protected get removeUsersWarning() {
    return this.i18nService.t("removeOrgUsersConfirmation");
  }

  static open(dialogService: DialogService, dialogConfig: DialogConfig<BulkRemoveDialogParams>) {
    return dialogService.open(BulkRemoveDialogComponent, dialogConfig);
  }
}
