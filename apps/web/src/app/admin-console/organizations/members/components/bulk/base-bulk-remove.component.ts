import { Directive, inject, signal } from "@angular/core";

import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Directive()
export abstract class BaseBulkRemoveComponent {
  protected readonly showNoMasterPasswordWarning = signal(false);
  protected readonly statuses = signal(new Map<string, string>());
  protected readonly done = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  protected i18nService = inject(I18nService);

  submit = async () => {
    this.loading.set(true);
    try {
      const deleteUsersResponse = await this.deleteUsers();
      const newStatuses = new Map<string, string>();
      deleteUsersResponse.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t("bulkRemovedMessage");
        newStatuses.set(entry.id, error);
      });
      this.statuses.set(newStatuses);
      this.done.set(true);
    } catch (e) {
      this.error.set((e as any)?.message ?? String(e));
    }

    this.loading.set(false);
  };

  protected abstract deleteUsers(): Promise<
    ListResponse<OrganizationUserBulkResponse | ProviderUserBulkResponse>
  >;

  protected abstract get removeUsersWarning(): string;
}
