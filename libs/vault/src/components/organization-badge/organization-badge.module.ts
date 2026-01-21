import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BadgeModule } from "@bitwarden/components";

import { OrganizationNameBadgeComponent } from "./organization-name-badge.component";

@NgModule({
  imports: [CommonModule, RouterModule, JslibModule, BadgeModule],
  declarations: [OrganizationNameBadgeComponent],
  exports: [OrganizationNameBadgeComponent],
})
export class OrganizationBadgeModule {}
