import { Component } from "@angular/core";

import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { OrganizationIntegrationsState } from "./organization-integrations.state";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "ac-integrations",
  templateUrl: "./integrations.component.html",
  imports: [SharedModule, HeaderModule],
})
export class AdminConsoleIntegrationsComponent {
  integrations = this.state.integrations;
  organization = this.state.organization;

  constructor(private state: OrganizationIntegrationsState) {}
}
