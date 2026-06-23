import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessVaultTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { VaultV2Component } from "./vault-v2.component";

const routes: Routes = [
  {
    path: "",
    component: VaultV2Component,
    data: { titleId: "vaults" },
    canActivate: [organizationPermissionsGuard(canAccessVaultTab)],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
