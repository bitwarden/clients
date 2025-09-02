// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationCardComponent } from "../integration-card/integration-card.component";

@Component({
  selector: "app-integration-grid",
  templateUrl: "./integration-grid.component.html",
  imports: [IntegrationCardComponent, SharedModule],
})
export class IntegrationGridComponent {
  @Input() integrations: Integration[];

  @Input() ariaI18nKey: string = "integrationCardAriaLabel";
  @Input() tooltipI18nKey: string = "integrationCardTooltip";

  protected IntegrationType = IntegrationType;
}
