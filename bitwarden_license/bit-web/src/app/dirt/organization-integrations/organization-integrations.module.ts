import { NgModule } from "@angular/core";

import { AdminConsoleIntegrationsComponent } from "./integrations.component";
import { OrganizationIntegrationsRoutingModule } from "./organization-integrations-routing.module";

@NgModule({
  imports: [AdminConsoleIntegrationsComponent, OrganizationIntegrationsRoutingModule],
  providers: [],
})
export class OrganizationIntegrationsModule {}
