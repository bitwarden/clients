import { Component, ChangeDetectionStrategy, Inject } from "@angular/core";

import { DrawerDetails, DrawerType } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { DIALOG_DATA } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

@Component({
  imports: [SharedModule],
  templateUrl: "./risk-insights-drawer-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskInsightsDrawerDialogComponent {
  constructor(@Inject(DIALOG_DATA) public drawerDetails: DrawerDetails) {}

  // Get a list of drawer types
  get drawerTypes(): typeof DrawerType {
    return DrawerType;
  }

  isActiveDrawerType(type: DrawerType): boolean {
    return this.drawerDetails.activeDrawerType === type;
  }
}
