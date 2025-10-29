import { Component, Input } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationCardComponent } from "../integration-card/integration-card.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-integration-grid",
  templateUrl: "./integration-grid.component.html",
  imports: [IntegrationCardComponent, SharedModule],
})
export class IntegrationGridComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() integrations: Integration[] = [];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() ariaI18nKey: string = "integrationCardAriaLabel";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() tooltipI18nKey: string = "integrationCardTooltip";

  protected IntegrationType = IntegrationType;
}
