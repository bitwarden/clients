import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DeprecatedVaultFilterService as DeprecatedVaultFilterServiceAbstraction } from "@bitwarden/angular/vault/abstractions/deprecated-vault-filter.service";
import { VaultFilterService } from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";

import { CollectionFilterComponent } from "./filters/collection-filter.component";
import { FolderFilterComponent } from "./filters/folder-filter.component";
import { OrganizationFilterComponent } from "./filters/organization-filter.component";
import { StatusFilterComponent } from "./filters/status-filter.component";
import { TypeFilterComponent } from "./filters/type-filter.component";
import { VaultFilterComponent } from "./vault-filter.component";

@NgModule({
  imports: [CommonModule, JslibModule],
  declarations: [
    VaultFilterComponent,
    CollectionFilterComponent,
    FolderFilterComponent,
    OrganizationFilterComponent,
    StatusFilterComponent,
    TypeFilterComponent,
  ],
  exports: [VaultFilterComponent],
  providers: [
    {
      provide: DeprecatedVaultFilterServiceAbstraction,
      useClass: VaultFilterService,
    },
  ],
})
export class VaultFilterModule {}
