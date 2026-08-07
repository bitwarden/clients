import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgModule } from "@angular/core";

import { ScrollLayoutDirective, IconModule } from "@bitwarden/components";
import { Vfo1I18nPipe, Vfo1IconPipe } from "@bitwarden/vault";

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
    IconModule,
    Vfo1IconPipe,
    Vfo1I18nPipe,
  ],
  declarations: [GroupsComponent, GroupAddEditComponent],
})
export class OrganizationModule {}
