import { NgModule } from "@angular/core";

import { CoreOrganizationModule } from "./core";
import { GroupAddDialogComponent, GroupEditDialogComponent } from "./manage/group-add-edit";
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
    GroupAddDialogComponent,
    GroupEditDialogComponent,
  ],
})
export class OrganizationModule {}
