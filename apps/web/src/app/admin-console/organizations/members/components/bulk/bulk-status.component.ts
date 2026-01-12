// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";

import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  ProviderUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogConfig, DialogService } from "@bitwarden/components";

import { OrganizationUserView } from "../../../core/views/organization-user.view";

export interface BulkUserDetails {
  id: string;
  name: string;
  email: string;
  status: OrganizationUserStatusType | ProviderUserStatusType;
  hasMasterPassword?: boolean;
  managedByOrganization?: boolean;
}

type BulkStatusEntry = {
  user: BulkUserDetails;
  error: boolean;
  message: string;
};

type BulkStatusDialogData = {
  users: Array<OrganizationUserView | ProviderUserUserDetailsResponse>;
  filteredUsers: Array<OrganizationUserView | ProviderUserUserDetailsResponse>;
  request: Promise<ListResponse<OrganizationUserBulkResponse | ProviderUserBulkResponse>>;
  successfulMessage: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-bulk-status",
  templateUrl: "bulk-status.component.html",
  standalone: false,
})
export class BulkStatusComponent implements OnInit {
  users: BulkStatusEntry[];
  loading = false;

  constructor(
    @Inject(DIALOG_DATA) protected data: BulkStatusDialogData,
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    this.loading = true;
    await this.showBulkStatus(this.data);
  }

  async showBulkStatus(data: BulkStatusDialogData) {
    try {
      const response = await data.request;
      const keyedErrors: any = response.data
        .filter((r) => r.error !== "")
        .reduce((a, x) => ({ ...a, [x.id]: x.error }), {});
      const keyedFilteredUsers: any = data.filteredUsers.reduce(
        (a, x) => ({ ...a, [x.id]: x }),
        {},
      );

      this.users = data.users.map((user) => {
        let message = keyedErrors[user.id] ?? data.successfulMessage;
        // eslint-disable-next-line
        if (!keyedFilteredUsers.hasOwnProperty(user.id)) {
          message = this.i18nService.t("bulkFilteredMessage");
        }

        return {
          user: user,
          error: keyedErrors.hasOwnProperty(user.id), // eslint-disable-line
          message: message,
        };
      });
      this.loading = false;
    } catch (e) {
      this.logService.error(e);
    }
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkStatusDialogData>) {
    return dialogService.open(BulkStatusComponent, config);
  }
}
