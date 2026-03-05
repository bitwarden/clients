import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";

import { ScrollLayoutDirective } from "@bitwarden/components";
import { OrganizationWarningsModule } from "@bitwarden/web-vault/app/billing/organizations/warnings/organization-warnings.module";

import { HeaderModule } from "../../layouts/header/header.module";

import { CoreOrganizationModule } from "./core";
import { GroupAddEditComponent } from "./manage/group-add-edit.component";
import { GroupsComponent } from "./manage/groups.component";
import { OrganizationsRoutingModule } from "./organization-routing.module";
import { SharedOrganizationModule } from "./shared";
import { AccessSelectorModule } from "./shared/components/access-selector";

@NgModule({
  imports: [
    SharedOrganizationModule,
    AccessSelectorModule,
    CoreOrganizationModule,
    OrganizationsRoutingModule,
    HeaderModule,
    ScrollingModule,
    ScrollLayoutDirective,
    OrganizationWarningsModule,
  ],
  declarations: [GroupsComponent, GroupAddEditComponent],
})
export class OrganizationModule {}
