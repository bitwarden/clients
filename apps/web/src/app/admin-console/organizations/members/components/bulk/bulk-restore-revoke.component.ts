// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { Observable } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import { BulkUserDetails } from "./bulk-status.component";

type BulkRestoreDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
  isRevoking: boolean;
};

@Component({
  selector: "app-bulk-restore-revoke",
  templateUrl: "bulk-restore-revoke.component.html",
})
export class BulkRestoreRevokeComponent {
  isRevoking: boolean;
  organizationId: string;
  users: BulkUserDetails[];

  statuses: Map<string, string> = new Map();

  loading = false;
  done = false;
  error: string;
  showNoMasterPasswordWarning = false;
  nonCompliantMembers: boolean = false;
  accountDeprovisioningEnabled$: Observable<boolean>;

  constructor(
    protected i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
    private configService: ConfigService,
    @Inject(DIALOG_DATA) protected data: BulkRestoreDialogParams,
  ) {
    this.isRevoking = data.isRevoking;
    this.organizationId = data.organizationId;
    this.users = data.users;
    this.showNoMasterPasswordWarning = this.users.some(
      (u) => u.status > OrganizationUserStatusType.Invited && u.hasMasterPassword === false,
    );
    this.accountDeprovisioningEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.AccountDeprovisioning,
    );
  }

  get bulkTitle() {
    const titleKey = this.isRevoking ? "revokeUsers" : "restoreUsers";
    return this.i18nService.t(titleKey);
  }

  get bulkMemberTitle() {
    const titleKey = this.isRevoking ? "revokeMembers" : "restoreMembers";
    return this.i18nService.t(titleKey);
  }

  submit = async () => {
    try {
      const response = await this.performBulkUserAction();

      const bulkMessage = this.isRevoking ? "bulkRevokedMessage" : "bulkRestoredMessage";

      response.data.forEach(async (entry) => {
        const error =
          entry.error !== ""
            ? this.i18nService.t("cannotRestoreAccessError")
            : this.i18nService.t(bulkMessage);
        this.statuses.set(entry.id, error);
        if (entry.error !== "") {
          this.nonCompliantMembers = true;
        }
      });
      this.done = true;
    } catch (e) {
      this.error = e.message;
    }
  };

  protected async performBulkUserAction() {
    const userIds = this.users.map((user) => user.id);
    if (this.isRevoking) {
      return await this.organizationUserApiService.revokeManyOrganizationUsers(
        this.organizationId,
        userIds,
      );
    } else {
      return await this.organizationUserApiService.restoreManyOrganizationUsers(
        this.organizationId,
        userIds,
      );
    }
  }

  static open(dialogService: DialogService, data: BulkRestoreDialogParams) {
    return dialogService.open(BulkRestoreRevokeComponent, { data });
  }
}
