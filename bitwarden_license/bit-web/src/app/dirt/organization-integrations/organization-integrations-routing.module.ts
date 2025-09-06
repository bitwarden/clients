import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { AdminConsoleIntegrationsComponent } from "./integrations.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard((org) => org.canAccessIntegrations)],
    component: AdminConsoleIntegrationsComponent,
    data: {
      titleId: "integrations",
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationIntegrationsRoutingModule {}
