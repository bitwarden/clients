import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { TableModule } from "@bitwarden/components";
import { CopyCipherFieldDirective } from "@bitwarden/vault";

import { SharedModule } from "../../../shared/shared.module";
import { OrganizationBadgeModule } from "../../individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../../individual-vault/pipes/pipes.module";
import { CollectionBadgeModule } from "../../org-vault/collection-badge/collection-badge.module";
import { GroupBadgeModule } from "../../org-vault/group-badge/group-badge.module";

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
    CopyCipherFieldDirective,
  ],
  declarations: [VaultItemsComponent, VaultCipherRowComponent, VaultCollectionRowComponent],
  exports: [VaultItemsComponent],
})
export class VaultItemsModule {}
