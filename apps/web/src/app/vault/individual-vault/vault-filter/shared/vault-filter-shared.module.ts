import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { PopoverModule, SearchModule } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";
import { CoachmarkComponent } from "../../../components/coachmark";

import { VaultFilterSectionComponent } from "./components/vault-filter-section.component";
import { AdvancedSearchComponent } from "../components/advanced-search/advanced-search.component";

@NgModule({
  imports: [SharedModule, SearchModule, PremiumBadgeComponent, PopoverModule, CoachmarkComponent, FormsModule],
  declarations: [VaultFilterSectionComponent, AdvancedSearchComponent],
  exports: [SharedModule, VaultFilterSectionComponent, SearchModule, AdvancedSearchComponent],
})
export class VaultFilterSharedModule { }
