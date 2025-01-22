import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AtRiskApplicationDetail } from "@bitwarden/bit-common/tools/reports/risk-insights/models/password-health";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

export const openOrgAtRiskMembersDialog = (
  dialogService: DialogService,
  dialogConfig: AtRiskApplicationDetail[],
) =>
  dialogService.open<boolean, AtRiskApplicationDetail[]>(OrgAtRiskAppsDialogComponent, {
    data: dialogConfig,
  });

@Component({
  standalone: true,
  templateUrl: "./org-at-risk-apps-dialog.component.html",
  imports: [ButtonModule, CommonModule, DialogModule, JslibModule, TypographyModule],
})
export class OrgAtRiskAppsDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected atRiskApps: AtRiskApplicationDetail[]) {}
}
