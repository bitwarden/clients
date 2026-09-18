import { Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { FilterIntegrationsPipe } from "@bitwarden/bit-common/dirt/organization-integrations/shared/filter-integrations.pipe";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationGridComponent } from "../../../dirt/organization-integrations/integration-grid/integration-grid.component";

/** Route `data` consumed by {@link SmIntegrationsTabComponent} to render a single tab. */
export type SmIntegrationsTabData = {
  integrationType: IntegrationType;
  descriptionKey: string;
  tooltipKey: string;
  ariaKey: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-integrations-tab",
  templateUrl: "./sm-integrations-tab.component.html",
  imports: [SharedModule, IntegrationGridComponent, FilterIntegrationsPipe],
})
export class SmIntegrationsTabComponent {
  private state = inject(IntegrationStateService);
  private data = inject(ActivatedRoute).snapshot.data;

  integrations = this.state.integrations;

  protected integrationType: IntegrationType = this.data.integrationType;
  protected descriptionKey: string = this.data.descriptionKey;
  protected tooltipKey: string = this.data.tooltipKey;
  protected ariaKey: string = this.data.ariaKey;
}
