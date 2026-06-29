import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import {
  AsyncActionsModule,
  AvatarModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { BaseBulkRemoveComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/base-bulk-remove.component";
import { BulkUserDetails } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";

type BulkRemoveDialogParams = {
  providerId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl:
    "../../../../../../../../apps/web/src/app/admin-console/organizations/members/components/bulk/bulk-remove-dialog.component.html",
  selector: "provider-bulk-remove-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    AvatarModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    I18nPipe,
    TableModule,
    UserNamePipe,
  ],
})
export class BulkRemoveDialogComponent extends BaseBulkRemoveComponent {
  private readonly dialogParams = inject<BulkRemoveDialogParams>(DIALOG_DATA);
  private readonly apiService = inject(ApiService);

  protected readonly providerId = signal(this.dialogParams.providerId);
  protected readonly users = signal(this.dialogParams.users);

  protected readonly deleteUsers = (): Promise<ListResponse<ProviderUserBulkResponse>> => {
    const request = new ProviderUserBulkRequest(this.users().map((user) => user.id));
    return this.apiService.deleteManyProviderUsers(this.providerId(), request);
  };

  protected get removeUsersWarning() {
    return this.i18nService.t("removeOrgUsersConfirmation");
  }

  static open(dialogService: DialogService, dialogConfig: DialogConfig<BulkRemoveDialogParams>) {
    return dialogService.open(BulkRemoveDialogComponent, dialogConfig);
  }
}
