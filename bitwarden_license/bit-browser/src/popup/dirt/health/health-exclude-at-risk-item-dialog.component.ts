import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { ButtonModule, DialogModule, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthAdditionalRisksComponent } from "./health-additional-risks.component";

export interface HealthExcludeAtRiskItemDialogData {
  currentCategory: RiskCategory;
  item: CipherHealthView;
}

/** Confirms excluding a login from the health report. Closes with `true` when confirmed. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-exclude-at-risk-item-dialog",
  templateUrl: "./health-exclude-at-risk-item-dialog.component.html",
  imports: [
    DialogModule,
    ButtonModule,
    IconModule,
    TypographyModule,
    I18nPipe,
    HealthAdditionalRisksComponent,
  ],
})
export class HealthExcludeAtRiskItemDialogComponent {
  protected readonly data = inject<HealthExcludeAtRiskItemDialogData>(DIALOG_DATA);
}
