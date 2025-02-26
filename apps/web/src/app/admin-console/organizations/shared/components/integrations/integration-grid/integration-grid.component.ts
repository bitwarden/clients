// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { IntegrationType } from "@bitwarden/common/enums";

import { SharedModule } from "../../../../../../shared/shared.module";
import { IntegrationCardComponent } from "../integration-card/integration-card.component";
import { Integration } from "../models";

@Component({
  selector: "app-integration-grid",
  templateUrl: "./integration-grid.component.html",
  standalone: true,
  imports: [IntegrationCardComponent, SharedModule],
})
export class IntegrationGridComponent {
  @Input() integrations: Integration[];

  @Input() ariaI18nKey: string = "integrationCardAriaLabel";
  @Input() tooltipI18nKey: string = "integrationCardTooltip";

  protected IntegrationType = IntegrationType;
}
