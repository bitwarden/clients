import { NgModule } from "@angular/core";

import { ExportScopeCalloutComponent } from "@bitwarden/vault-export-ui";

import { LooseComponentsModule, SharedModule } from "../../shared";

import { ExportRoutingModule } from "./export-routing.module";
import { ExportComponent } from "./export.component";

@NgModule({
  imports: [SharedModule, LooseComponentsModule, ExportRoutingModule, ExportScopeCalloutComponent],
  declarations: [ExportComponent],
})
export class ExportModule {}
