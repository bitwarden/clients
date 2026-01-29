// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { DIALOG_DATA, DialogService } from "@bitwarden/components";

import { BulkUserDetails } from "./bulk-status.component";

type BulkRestoreDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
  isRevoking: boolean;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "member-bulk-restore-revoke",
  templateUrl: "bulk-restore-revoke.component.html",
  standalone: false,
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
  organization$: Observable<Organization>;

  constructor(
    protected i18nService: I18nService,
    private organizationUserApiService: OrganizationUserApiService,
    private organizationUserService: OrganizationUserService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private configService: ConfigService,
    @Inject(DIALOG_DATA) protected data: BulkRestoreDialogParams,
  ) {
    this.isRevoking = data.isRevoking;
    this.organizationId = data.organizationId;
    this.users = data.users;
    this.showNoMasterPasswordWarning = this.users.some(
      (u) => u.status > OrganizationUserStatusType.Invited && u.hasMasterPassword === false,
    );

    this.organization$ = accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => organizationService.organizations$(userId)),
      getById(this.organizationId),
      map((organization) => {
        if (organization == null) {
          throw new Error("Organization not found");
        }
        return organization;
      }),
    );
  }

  get bulkTitle() {
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
      return await firstValueFrom(
        combineLatest([
          this.configService.getFeatureFlag$(FeatureFlag.DefaultUserCollectionRestore),
          this.organization$,
        ]).pipe(
          switchMap(([enabled, organization]) => {
            if (enabled) {
              return this.organizationUserService.bulkRestoreUsers(organization, userIds);
            } else {
              return this.organizationUserApiService.restoreManyOrganizationUsers(
                this.organizationId,
                userIds,
              );
            }
          }),
        ),
      );
    }
  }

  static open(dialogService: DialogService, data: BulkRestoreDialogParams) {
    return dialogService.open(BulkRestoreRevokeComponent, { data });
  }
}
