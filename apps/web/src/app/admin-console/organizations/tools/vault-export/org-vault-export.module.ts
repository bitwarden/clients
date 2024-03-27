import { NgModule } from "@angular/core";

import { ExportScopeCalloutComponent } from "@bitwarden/vault-export-ui";

import { LooseComponentsModule, SharedModule } from "../../../../shared";

import { OrganizationVaultExportRoutingModule } from "./org-vault-export-routing.module";
import { OrganizationVaultExportComponent } from "./org-vault-export.component";

@NgModule({
  imports: [
    SharedModule,
    LooseComponentsModule,
    OrganizationVaultExportRoutingModule,
    ExportScopeCalloutComponent,
  ],
  declarations: [OrganizationVaultExportComponent],
})
export class OrganizationVaultExportModule {}
