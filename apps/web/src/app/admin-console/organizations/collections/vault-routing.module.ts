import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessVaultTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { VaultComponent } from "./vault.component";

const routes: Routes = [
  {
    data: { titleId: "vaults" },
    path: "",
    canActivate: [organizationPermissionsGuard(canAccessVaultTab)],
    component: VaultComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
