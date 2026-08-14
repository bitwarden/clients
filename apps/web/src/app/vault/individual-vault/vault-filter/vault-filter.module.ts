import { NgModule } from "@angular/core";

import { SearchModule, IconModule } from "@bitwarden/components";
import { VaultFilterServiceAbstraction } from "@bitwarden/vault";

import { VaultFilterSharedModule } from "../../individual-vault/vault-filter/shared/vault-filter-shared.module";

import { OrganizationOptionsComponent } from "./components/organization-options.component";
import { VaultFilterComponent } from "./components/vault-filter.component";
import { WebIndividualVaultFilterService } from "./web-individual-vault-filter.service";

@NgModule({
  imports: [VaultFilterSharedModule, SearchModule, IconModule],
  declarations: [VaultFilterComponent, OrganizationOptionsComponent],
  exports: [VaultFilterComponent],
  providers: [
    {
      // Web individual vault includes PAM-gated ("partial") ciphers in the folder filter tree,
      // matching its list; other clients use the base VaultFilterService, which excludes them.
      provide: VaultFilterServiceAbstraction,
      useClass: WebIndividualVaultFilterService,
    },
  ],
})
export class VaultFilterModule {}
