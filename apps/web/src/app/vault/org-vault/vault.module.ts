import { NgModule } from "@angular/core";

import { BreadcrumbsModule, NoItemsModule, SearchModule } from "@bitwarden/components";

import { LooseComponentsModule } from "../../shared/loose-components.module";
import { SharedModule } from "../../shared/shared.module";
import { OrganizationBadgeModule } from "../../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../vault/individual-vault/pipes/pipes.module";
import { CollectionDialogModule } from "../components/collection-dialog";
import { VaultItemsModule } from "../components/vault-items/vault-items.module";

import { CollectionAccessRestrictedComponent } from "./collection-access-restricted.component";
import { CollectionBadgeModule } from "./collection-badge/collection-badge.module";
import { GroupBadgeModule } from "./group-badge/group-badge.module";
import { VaultFilterModule } from "./vault-filter/vault-filter.module";
import { VaultHeaderComponent } from "./vault-header/vault-header.component";
import { VaultRoutingModule } from "./vault-routing.module";
import { VaultComponent } from "./vault.component";

@NgModule({
  imports: [
    VaultRoutingModule,
    VaultFilterModule,
    SharedModule,
    LooseComponentsModule,
    GroupBadgeModule,
    CollectionBadgeModule,
    OrganizationBadgeModule,
    PipesModule,
    BreadcrumbsModule,
    VaultItemsModule,
    CollectionDialogModule,
    CollectionAccessRestrictedComponent,
    NoItemsModule,
    SearchModule,
  ],
  declarations: [VaultComponent, VaultHeaderComponent],
  exports: [VaultComponent],
})
export class VaultModule {}
