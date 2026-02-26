// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationCardComponent } from "../integration-card/integration-card.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-integration-grid",
  templateUrl: "./integration-grid.component.html",
  imports: [IntegrationCardComponent, SharedModule],
})
export class IntegrationGridComponent {
  readonly integrations = input.required<Integration[]>();
  readonly ariaI18nKey = input<string>("integrationCardAriaLabel");
  readonly tooltipI18nKey = input<string>("integrationCardTooltip");

  protected IntegrationType = IntegrationType;
}
