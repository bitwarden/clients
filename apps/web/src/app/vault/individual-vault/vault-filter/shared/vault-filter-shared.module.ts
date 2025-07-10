import { NgModule } from "@angular/core";

import { SearchModule } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";

import { VaultFilterSectionComponent } from "./components/vault-filter-section.component";

@NgModule({
  imports: [SharedModule, SearchModule],
  declarations: [VaultFilterSectionComponent],
  exports: [SharedModule, VaultFilterSectionComponent, SearchModule],
})
export class VaultFilterSharedModule {}
