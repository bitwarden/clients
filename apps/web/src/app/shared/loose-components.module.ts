import { NgModule } from "@angular/core";

import { FreeBitwardenFamiliesComponent } from "../billing/members/free-bitwarden-families.component";
import { SponsoredFamiliesComponent } from "../billing/settings/sponsored-families.component";
import { SponsoringOrgRowComponent } from "../billing/settings/sponsoring-org-row.component";
import { HeaderModule } from "../layouts/header/header.module";
import { OrganizationBadgeModule } from "../vault/individual-vault/organization-badge/organization-badge.module";
import { PipesModule } from "../vault/individual-vault/pipes/pipes.module";

import { SharedModule } from "./shared.module";

// Please do not add to this list of declarations - we should refactor these into modules when doing so makes sense until there are none left.
// If you are building new functionality, please create or extend a feature module instead.
@NgModule({
  imports: [SharedModule, HeaderModule, OrganizationBadgeModule, PipesModule],
  declarations: [
    SponsoredFamiliesComponent,
    FreeBitwardenFamiliesComponent,
    SponsoringOrgRowComponent,
  ],
  exports: [SponsoredFamiliesComponent],
})
export class LooseComponentsModule {}
