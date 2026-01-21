import { NgModule } from "@angular/core";

import { CollectionDialogComponent } from "@bitwarden/components";
import { OrganizationBadgeModule, PipesModule } from "@bitwarden/vault";

import { CollectionNameBadgeComponent } from "../../admin-console/organizations/collections";
import { GroupBadgeModule } from "../../admin-console/organizations/collections/group-badge/group-badge.module";
import { SharedModule } from "../../shared";

import { BulkDialogsModule } from "./bulk-action-dialogs/bulk-dialogs.module";
import { VaultRoutingModule } from "./vault-routing.module";
import { VaultComponent } from "./vault.component";

@NgModule({
  imports: [
    VaultRoutingModule,
    OrganizationBadgeModule,
    GroupBadgeModule,
    CollectionNameBadgeComponent,
    PipesModule,
    SharedModule,
    BulkDialogsModule,
    CollectionDialogComponent,
    VaultComponent,
  ],
})
export class VaultModule {}
