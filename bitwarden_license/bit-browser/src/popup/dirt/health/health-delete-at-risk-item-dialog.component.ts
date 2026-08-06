import { Component, ChangeDetectionStrategy } from "@angular/core";

import { DialogModule, ButtonModule } from "@bitwarden/components";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-delete-at-risk-item-dialog",
  templateUrl: "./health-delete-at-risk-item-dialog.component.html",
  imports: [DialogModule, ButtonModule],
})
export class HealthDeleteAtRiskItemDialogComponent {}
