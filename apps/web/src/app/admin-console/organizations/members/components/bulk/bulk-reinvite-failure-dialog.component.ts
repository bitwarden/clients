import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { AsyncPipe, LowerCasePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, signal, WritableSignal } from "@angular/core";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  AvatarModule,
  ButtonModule,
  DialogConfig,
  DialogModule,
  DialogService,
  IconModule,
  LinkModule,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { MembersTableDataSource } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

import { OrganizationUserView } from "../../../core";
import { AvatarIdPipe } from "../../pipes/avatar-id.pipe";
import { BulkActionResult } from "../../services/member-actions/member-actions.types";

export interface BulkReinviteFailureDialogParams {
  result: BulkActionResult;
  users: OrganizationUserView[];
  organization: Organization;
}

@Component({
  templateUrl: "bulk-reinvite-failure-dialog.component.html",
  selector: "member-bulk-reinvite-failure-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    AvatarIdPipe,
    AvatarModule,
    ButtonModule,
    DialogModule,
    I18nPipe,
    IconModule,
    LinkModule,
    LowerCasePipe,
    TableModule,
    UserNamePipe,
  ],
})
export class BulkReinviteFailureDialogComponent {
  protected readonly totalCount: string;
  protected readonly dataSource: WritableSignal<MembersTableDataSource>;

  constructor(
    readonly dialogRef: DialogRef<OrganizationUserView[]>,
    @Inject(DIALOG_DATA) data: BulkReinviteFailureDialogParams,
    environmentService: EnvironmentService,
  ) {
    this.totalCount = (data.users.length ?? 0).toLocaleString();
    this.dataSource = signal(new MembersTableDataSource(environmentService));
    this.dataSource().data = data.result.failed.map((failedUser) => {
      const user = data.users.find((u) => u.id === failedUser.id);
      if (user == null) {
        throw new Error("Member not found");
      }
      return user;
    });
  }

  resendInvitations() {
    return this.dialogRef.close(this.dataSource().data);
  }

  cancel() {
    this.dialogRef.close([]);
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkReinviteFailureDialogParams>) {
    return dialogService.open(BulkReinviteFailureDialogComponent, config);
  }
}
