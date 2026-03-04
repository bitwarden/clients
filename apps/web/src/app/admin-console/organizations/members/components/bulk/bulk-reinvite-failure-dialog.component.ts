import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, Inject, signal, WritableSignal } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { DialogService } from "@bitwarden/components";
import { MembersTableDataSource } from "@bitwarden/web-vault/app/admin-console/common/people-table-data-source";

import { OrganizationUserView } from "../../../core";
import {
  BulkActionResult,
  MemberActionsService,
} from "../../services/member-actions/member-actions.service";

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
  private organization: Organization;
  protected totalCount: string;
  protected readonly dataSource: WritableSignal<MembersTableDataSource>;

  constructor(
    public dialogRef: DialogRef,
    private memberActionsService: MemberActionsService,
    @Inject(DIALOG_DATA) data: BulkReinviteFailureDialogParams,
    environmentService: EnvironmentService,
  ) {
    this.organization = data.organization;
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

  async resendInvitations() {
    await this.memberActionsService.bulkReinvite(this.organization, this.dataSource().data);
    this.dialogRef.close();
  }

  async cancel() {
    this.dialogRef.close();
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkReinviteFailureDialogParams>) {
    return dialogService.open(BulkReinviteFailureDialogComponent, config);
  }
}
