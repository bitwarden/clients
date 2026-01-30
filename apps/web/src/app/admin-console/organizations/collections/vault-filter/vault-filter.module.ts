import { NgModule } from "@angular/core";

import { SearchModule } from "@bitwarden/components";
import { VaultFilterServiceAbstraction } from "@bitwarden/vault";

import { VaultFilterSharedModule } from "../../../../vault/individual-vault/vault-filter/shared/vault-filter-shared.module";

import { VaultFilterComponent } from "./vault-filter.component";
import { VaultFilterService } from "./vault-filter.service";

@NgModule({
  imports: [VaultFilterSharedModule, SearchModule],
  declarations: [VaultFilterComponent],
  exports: [VaultFilterComponent],
  providers: [
    {
      provide: VaultFilterServiceAbstraction,
      useClass: VaultFilterService,
    },
  ],
})
export class VaultFilterModule {}
