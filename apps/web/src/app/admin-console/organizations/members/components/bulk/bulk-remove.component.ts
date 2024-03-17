import { Component, Input } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BulkUserDetails } from "./bulk-status.component";

@Component({
  selector: "app-bulk-remove",
  templateUrl: "bulk-remove.component.html",
})
export class BulkRemoveComponent {
  @Input() organizationId: string;
  @Input() set users(value: BulkUserDetails[]) {
    this._users = value;
    this.showNoMasterPasswordWarning = this._users.some(
      (u) => u.status > OrganizationUserStatusType.Invited && u.hasMasterPassword === false,
    );
  }

  get users(): BulkUserDetails[] {
    return this._users;
  }

  private _users: BulkUserDetails[];

  statuses: Map<string, string> = new Map();

  loading = false;
  done = false;
  error: string;
  showNoMasterPasswordWarning = false;

  constructor(
    protected apiService: ApiService,
    protected i18nService: I18nService,
    private organizationUserService: OrganizationUserService,
  ) {}

  async submit() {
    this.loading = true;
    try {
      const response = await this.deleteUsers();

      response.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t("bulkRemovedMessage");
        this.statuses.set(entry.id, error);
      });
      this.done = true;
    } catch (e) {
      this.error = e.message;
    }

    this.loading = false;
  }

  protected async deleteUsers() {
    return await this.organizationUserService.deleteManyOrganizationUsers(
      this.organizationId,
      this.users.map((user) => user.id),
    );
  }

  protected get removeUsersWarning() {
    return this.i18nService.t("removeOrgUsersConfirmation");
  }
}
