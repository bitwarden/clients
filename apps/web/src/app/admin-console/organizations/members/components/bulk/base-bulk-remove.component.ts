// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive } from "@angular/core";

import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Directive()
export abstract class BaseBulkRemoveComponent {
  protected showNoMasterPasswordWarning: boolean;
  protected statuses: Map<string, string> = new Map();

  protected done = false;
  protected loading = false;
  protected error: string;

  protected constructor(protected i18nService: I18nService) {}

  submit = async () => {
    this.loading = true;
    try {
      const deleteUsersResponse = await this.deleteUsers();
      deleteUsersResponse.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t("bulkRemovedMessage");
        this.statuses.set(entry.id, error);
      });
      this.done = true;
    } catch (e) {
      this.error = e.message;
    }

    this.loading = false;
  };

  protected abstract deleteUsers(): Promise<
    ListResponse<OrganizationUserBulkResponse | ProviderUserBulkResponse>
  >;

  protected abstract get removeUsersWarning(): string;
}
