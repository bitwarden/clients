import { NgModule } from "@angular/core";

import { CollectionDialogComponent } from "@bitwarden/components";
import { OrganizationBadgeModule } from "@bitwarden/vault";

import { SharedModule } from "../../../shared/shared.module";

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
