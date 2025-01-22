import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MemberDetailsFlat } from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

type AppAtRiskMembersDialogParams = {
  members: MemberDetailsFlat[];
  applicationName: string;
};

export const openAppAtRiskMembersDialog = (
  dialogService: DialogService,
  dialogConfig: AppAtRiskMembersDialogParams,
) =>
  dialogService.open<boolean, AppAtRiskMembersDialogParams>(AppAtRiskMembersDialogComponent, {
    data: dialogConfig,
  });

@Component({
  standalone: true,
  templateUrl: "./app-at-risk-members-dialog.component.html",
  imports: [ButtonModule, CommonModule, JslibModule, DialogModule],
})
export class AppAtRiskMembersDialogComponent {
  protected members: MemberDetailsFlat[];
  protected applicationName: string;

  constructor(@Inject(DIALOG_DATA) private params: AppAtRiskMembersDialogParams) {
    this.members = params.members;
    this.applicationName = params.applicationName;
  }
}
