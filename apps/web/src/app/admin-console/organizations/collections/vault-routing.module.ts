import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessVaultTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { orgVaultDefaultFilterGuard } from "./org-vault-default-filter.guard";
import { VaultComponent } from "./vault.component";

const routes: Routes = [
  {
    path: "",
    component: VaultComponent,
    data: { titleId: "vaults" },
    canActivate: [organizationPermissionsGuard(canAccessVaultTab), orgVaultDefaultFilterGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
