import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
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

import { BaseBulkRemoveComponent } from "./base-bulk-remove.component";
import { BulkUserDetails } from "./bulk-status.component";

type BulkRemoveDialogParams = {
  organizationId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl: "bulk-remove-dialog.component.html",
  selector: "member-bulk-remove-dialog",
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
  private readonly organizationUserApiService = inject(OrganizationUserApiService);

  protected readonly organizationId = signal(this.dialogParams.organizationId);
  protected readonly users = signal(this.dialogParams.users);

  constructor() {
    super();
    this.showNoMasterPasswordWarning.set(
      this.users().some(
        (u) => u.status > OrganizationUserStatusType.Invited && u.hasMasterPassword === false,
      ),
    );
  }

  protected readonly deleteUsers = (): Promise<ListResponse<OrganizationUserBulkResponse>> =>
    this.organizationUserApiService.removeManyOrganizationUsers(
      this.organizationId(),
      this.users().map((user) => user.id),
    );

  protected get removeUsersWarning() {
    return this.i18nService.t("removeOrgUsersConfirmation");
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkRemoveDialogParams>) {
    return dialogService.open(BulkRemoveDialogComponent, config);
  }
}
