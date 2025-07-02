import { NgModule } from "@angular/core";

import { VaultFilterService as SharedVaultFilterService } from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
import { SearchModule } from "@bitwarden/components";

import { VaultFilterSharedModule } from "../../individual-vault/vault-filter/shared/vault-filter-shared.module";

import { OrganizationOptionsComponent } from "./components/organization-options.component";
import { VaultFilterComponent } from "./components/vault-filter.component";
import { VaultFilterService as VaultFilterServiceAbstraction } from "./services/abstractions/vault-filter.service";
import { VaultFilterService } from "./services/vault-filter.service";

@NgModule({
  imports: [VaultFilterSharedModule, SearchModule],
  declarations: [VaultFilterComponent, OrganizationOptionsComponent],
  exports: [VaultFilterComponent],
  providers: [
    {
      provide: VaultFilterServiceAbstraction,
      useClass: VaultFilterService,
    },
    {
      provide: SharedVaultFilterService,
      useClass: SharedVaultFilterService,
    },
  ],
})
export class VaultFilterModule {}
