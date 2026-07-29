import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, Inject, signal, WritableSignal } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { DialogConfig, DialogService } from "@bitwarden/components";
import { MembersTableDataSource } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

import { OrganizationUserView } from "../../../core";
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
  standalone: false,
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
