import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  BadgeModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  ScrollLayoutDirective,
  TableModule,
} from "@bitwarden/components";
import { CopyCipherFieldDirective } from "@bitwarden/vault";

import { OrganizationNameBadgeComponent } from "../organization-badge/organization-name-badge.component";
import { PipesModule } from "../pipes/pipes.module";

import { VaultCipherRowComponent } from "./vault-cipher-row.component";
import { VaultCollectionRowComponent } from "./vault-collection-row.component";

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    ScrollingModule,
    JslibModule,
    TableModule,
    MenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    BadgeModule,
    CopyCipherFieldDirective,
    ScrollLayoutDirective,
    PremiumBadgeComponent,
    OrganizationNameBadgeComponent,
    PipesModule,
  ],
  declarations: [VaultCipherRowComponent, VaultCollectionRowComponent],
  exports: [VaultCipherRowComponent, VaultCollectionRowComponent],
})
export class VaultItemsModule {}
