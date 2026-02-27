import { NgModule } from "@angular/core";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { SearchModule } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";

import { VaultFilterSectionComponent } from "./components/vault-filter-section.component";

@NgModule({
  imports: [SharedModule, SearchModule, PremiumBadgeComponent],
  declarations: [VaultFilterSectionComponent],
  exports: [SharedModule, VaultFilterSectionComponent, SearchModule],
})
export class VaultFilterSharedModule {}
