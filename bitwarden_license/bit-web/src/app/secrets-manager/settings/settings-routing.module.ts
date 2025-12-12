import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { SecretsManagerExportComponent } from "./porting/sm-export.component";
import { SecretsManagerImportComponent } from "./porting/sm-import.component";

const routes: Routes = [
  {
    path: "import",
    component: SecretsManagerImportComponent,
    canActivate: [organizationPermissionsGuard((org) => org.isAdmin)],
    data: {
      titleId: "import",
    },
  },
  {
    path: "export",
    component: SecretsManagerExportComponent,
    canActivate: [organizationPermissionsGuard((org) => org.isAdmin)],
    data: {
      titleId: "export",
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
