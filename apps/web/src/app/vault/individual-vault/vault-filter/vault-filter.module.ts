import { NgModule } from "@angular/core";

import { SearchModule } from "@bitwarden/components";
import { OrganizationWarningsModule } from "@bitwarden/web-vault/app/billing/organizations/warnings/organization-warnings.module";

import { VaultFilterSharedModule } from "../../individual-vault/vault-filter/shared/vault-filter-shared.module";

import { OrganizationOptionsComponent } from "./components/organization-options.component";
import { VaultFilterComponent } from "./components/vault-filter.component";
import { VaultFilterService as VaultFilterServiceAbstraction } from "./services/abstractions/vault-filter.service";
import { VaultFilterService } from "./services/vault-filter.service";

@NgModule({
  imports: [VaultFilterSharedModule, SearchModule, OrganizationWarningsModule],
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
