import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { DeviceManagementComponent } from "./device-management/device-management.component";
import { EventManagementComponent } from "./event-management/event-management.component";
import { AdminConsoleIntegrationsComponent } from "./integrations.component";
import { OrganizationIntegrationsResolver } from "./organization-integrations.resolver";
import { SingleSignOnComponent } from "./single-sign-on/single-sign-on.component";
import { UserProvisioningComponent } from "./user-provisioning/user-provisioning.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard((org) => org.canAccessIntegrations)],
    data: {
      titleId: "integrations",
    },
    component: AdminConsoleIntegrationsComponent,
    providers: [OrganizationIntegrationsResolver],
    resolve: { integrations: OrganizationIntegrationsResolver },
    children: [
      { path: "", redirectTo: "single-sign-on", pathMatch: "full" },
      { path: "single-sign-on", component: SingleSignOnComponent },
      { path: "user-provisioning", component: UserProvisioningComponent },
      { path: "event-management", component: EventManagementComponent },
      { path: "device-management", component: DeviceManagementComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationIntegrationsRoutingModule {}
