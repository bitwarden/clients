import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { TableModule } from "@bitwarden/components";

import { CollectionBadgeModule } from "../../../admin-console/organizations/collections/collection-badge/collection-badge.module";
import { GroupBadgeModule } from "../../../admin-console/organizations/collections/group-badge/group-badge.module";
import { SharedModule } from "../../../shared/shared.module";
import { OrganizationBadgeModule } from "../../individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../individual-vault/pipes/pipes.module";

import { VaultCipherRowComponent } from "./vault-cipher-row.component";
import { VaultCollectionRowComponent } from "./vault-collection-row.component";
import { VaultItemsComponent } from "./vault-items.component";

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    ScrollingModule,
    SharedModule,
    TableModule,
    OrganizationBadgeModule,
    CollectionBadgeModule,
    GroupBadgeModule,
    PipesModule,
  ],
  declarations: [VaultItemsComponent, VaultCipherRowComponent, VaultCollectionRowComponent],
  exports: [VaultItemsComponent],
})
export class VaultItemsModule {}
