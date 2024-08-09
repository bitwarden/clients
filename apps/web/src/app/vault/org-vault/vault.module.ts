import { NgModule } from "@angular/core";

import { LooseComponentsModule } from "../../shared/loose-components.module";
import { SharedModule } from "../../shared/shared.module";
import { OrganizationBadgeModule } from "../../vault/individual-vault/organization-badge/organization-badge.module";
import { CollectionDialogModule } from "../components/collection-dialog";
import { ViewComponent } from "../individual-vault/view.component";

import { CollectionBadgeModule } from "./collection-badge/collection-badge.module";
import { GroupBadgeModule } from "./group-badge/group-badge.module";
import { VaultRoutingModule } from "./vault-routing.module";
import { VaultComponent } from "./vault.component";

@NgModule({
  imports: [
    VaultRoutingModule,
    SharedModule,
    LooseComponentsModule,
    GroupBadgeModule,
    CollectionBadgeModule,
    OrganizationBadgeModule,
    CollectionDialogModule,
    VaultComponent,
    ViewComponent,
  ],
})
export class VaultModule {}
