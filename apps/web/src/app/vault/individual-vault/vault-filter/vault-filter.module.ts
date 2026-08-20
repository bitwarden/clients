import { NgModule } from "@angular/core";

import { SearchModule, IconModule } from "@bitwarden/components";
import { VaultFilterServiceAbstraction, VaultFilterService } from "@bitwarden/vault";

import { VaultFilterSharedModule } from "../../individual-vault/vault-filter/shared/vault-filter-shared.module";

import { OrganizationOptionsComponent } from "./components/organization-options.component";
import { VaultFilterComponent } from "./components/vault-filter.component";

@NgModule({
  imports: [VaultFilterSharedModule, SearchModule, IconModule],
  declarations: [VaultFilterComponent, OrganizationOptionsComponent],
  exports: [VaultFilterComponent],
  providers: [
    {
      provide: VaultFilterServiceAbstraction,
      useClass: VaultFilterService,
    },
  ],
})
export class VaultFilterModule {}
