import { NgModule } from "@angular/core";

import { CoreOrganizationModule } from "./core";
import { GroupAddDialogComponent, GroupEditDialogComponent } from "./manage/group-add-edit";
import { GroupsV2Component } from "./manage/groups-v2.component";
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
    GroupsComponent,
    GroupsV2Component,
    GroupAddDialogComponent,
    GroupEditDialogComponent,
  ],
})
export class OrganizationModule {}
