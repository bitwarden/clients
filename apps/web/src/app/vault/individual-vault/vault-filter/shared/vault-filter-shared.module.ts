import { NgModule } from "@angular/core";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { PopoverModule, SearchModule } from "@bitwarden/components";
import { CoachmarkComponent } from "@bitwarden/vault";

import { SharedModule } from "../../../../shared";

import { VaultFilterSectionComponent } from "./components/vault-filter-section.component";

@NgModule({
  imports: [SharedModule, SearchModule, PremiumBadgeComponent, PopoverModule, CoachmarkComponent],
  declarations: [VaultFilterSectionComponent],
  exports: [SharedModule, VaultFilterSectionComponent, SearchModule],
})
export class VaultFilterSharedModule {}
