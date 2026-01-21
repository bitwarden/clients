import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";

import { CoreOrganizationModule } from "@bitwarden/angular/admin-console/core";
import { OrganizationWarningsModule } from "@bitwarden/angular/billing/organizations/warnings";
import { ScrollLayoutDirective, AccessSelectorModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";

import { GroupAddEditComponent } from "./manage/group-add-edit.component";
import { GroupsComponent } from "./manage/groups.component";
import { OrganizationsRoutingModule } from "./organization-routing.module";
import { SharedOrganizationModule } from "./shared";

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
