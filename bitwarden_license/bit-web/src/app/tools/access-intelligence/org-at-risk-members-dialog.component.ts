import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AtRiskMemberDetail } from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

export const openOrgAtRiskMembersDialog = (
  dialogService: DialogService,
  dialogConfig: AtRiskMemberDetail[],
) =>
  dialogService.open<boolean, AtRiskMemberDetail[]>(OrgAtRiskMembersDialogComponent, {
    data: dialogConfig,
  });

@Component({
  standalone: true,
  templateUrl: "./org-at-risk-members-dialog.component.html",
  imports: [ButtonModule, CommonModule, DialogModule, JslibModule, TypographyModule],
})
export class OrgAtRiskMembersDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected atRiskMembers: AtRiskMemberDetail[]) {}
}
