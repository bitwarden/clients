import { Component } from "@angular/core";

import { FilterIntegrationsPipe } from "@bitwarden/bit-common/dirt/organization-integrations/shared/filter-integrations.pipe";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums/integration-type.enum";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationGridComponent } from "../integration-grid/integration-grid.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "single-sign-on",
  templateUrl: "single-sign-on.component.html",
  imports: [SharedModule, IntegrationGridComponent, FilterIntegrationsPipe],
})
export class SingleSignOnComponent {
  integrations = this.state.integrations;
  IntegrationType = IntegrationType;

  constructor(private state: IntegrationStateService) {}
}
