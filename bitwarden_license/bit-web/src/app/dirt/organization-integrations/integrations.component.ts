import { Component } from "@angular/core";

import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums/integration-type.enum";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "ac-integrations",
  templateUrl: "./integrations.component.html",
  imports: [SharedModule, HeaderModule],
})
export class AdminConsoleIntegrationsComponent {
  organization = this.state.organization;

  constructor(private state: IntegrationStateService) {}

  // use in the view
  get IntegrationType(): typeof IntegrationType {
    return IntegrationType;
  }
}
