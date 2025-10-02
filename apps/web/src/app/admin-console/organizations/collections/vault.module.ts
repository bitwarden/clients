import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared/shared.module";
import { OrganizationBadgeModule } from "../../../vault/individual-vault/organization-badge/organization-badge.module";
import { CollectionDialogComponent } from "../shared/components/collection-dialog";

import { CollectionNameBadgeComponent } from "./collection-badge";
import { GroupBadgeModule } from "./group-badge/group-badge.module";
import { VaultRoutingModule } from "./vault-routing.module";
import { VaultComponent } from "./vault.component";

@NgModule({
  imports: [
    VaultRoutingModule,
    SharedModule,
    GroupBadgeModule,
    CollectionNameBadgeComponent,
    OrganizationBadgeModule,
    CollectionDialogComponent,
    VaultComponent,
  ],
})
export class VaultModule {}
