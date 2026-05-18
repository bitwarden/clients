import { NgModule } from "@angular/core";

import { GovernanceDashboardComponent } from "./governance-dashboard.component";
import { PamGovernanceRoutingModule } from "./pam-governance-routing.module";

/**
 * Entry module for the PAM governance dashboard (PM-37277). The dashboard
 * component is standalone; the module exists only to host route
 * configuration via lazy load from the organization routing module.
 */
@NgModule({
  imports: [PamGovernanceRoutingModule, GovernanceDashboardComponent],
})
export class PamGovernanceModule {}
