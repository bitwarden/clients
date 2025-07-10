import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared/shared.module";

import { OrganizationNameBadgeComponent } from "./organization-name-badge.component";

@NgModule({
  imports: [SharedModule],
  declarations: [OrganizationNameBadgeComponent],
  exports: [OrganizationNameBadgeComponent],
})
export class OrganizationBadgeModule {}
