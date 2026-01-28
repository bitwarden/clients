import { Component } from "@angular/core";

import { IntegrationType } from "@bitwarden/common/enums/integration-type.enum";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationGridComponent } from "../integration-grid/integration-grid.component";
import { FilterIntegrationsPipe } from "../integrations.pipe";
import { OrganizationIntegrationsState } from "../organization-integrations.state";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "user-provisioning",
  templateUrl: "user-provisioning.component.html",
  imports: [SharedModule, IntegrationGridComponent, FilterIntegrationsPipe],
})
export class UserProvisioningComponent {
  organization = this.state.organization;
  integrations = this.state.integrations;

  constructor(private state: OrganizationIntegrationsState) {}

  get IntegrationType(): typeof IntegrationType {
    return IntegrationType;
  }
}
