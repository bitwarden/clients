import { NgModule } from "@angular/core";

import { LooseComponentsModule, SharedModule } from "../../shared";
import { CollectionDialogModule } from "../components/collection-dialog";
import { CollectionBadgeModule } from "../org-vault/collection-badge/collection-badge.module";
import { GroupBadgeModule } from "../org-vault/group-badge/group-badge.module";

import { BulkDialogsModule } from "./bulk-action-dialogs/bulk-dialogs.module";
import { OrganizationBadgeModule } from "./organization-badge/organization-badge.module";
import { PipesModule } from "./pipes/pipes.module";
import { VaultRoutingModule } from "./vault-routing.module";
import { VaultComponent } from "./vault.component";
import { ViewComponent } from "./view.component";

@NgModule({
  imports: [
    VaultRoutingModule,
    OrganizationBadgeModule,
    GroupBadgeModule,
    CollectionBadgeModule,
    PipesModule,
    SharedModule,
    LooseComponentsModule,
    BulkDialogsModule,
    CollectionDialogModule,
    VaultComponent,
    ViewComponent,
  ],
})
export class VaultModule {}
