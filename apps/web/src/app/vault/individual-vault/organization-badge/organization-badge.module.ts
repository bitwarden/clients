import { NgModule } from "@angular/core";

import { OrganizationNameBadgeComponent } from "@bitwarden/vault";

import { SharedModule } from "../../../shared/shared.module";

/**
 * @deprecated Use `OrganizationNameBadgeComponent` directly since it is now standalone.
 */
@NgModule({
  imports: [SharedModule, OrganizationNameBadgeComponent],
  exports: [OrganizationNameBadgeComponent],
})
export class OrganizationBadgeModule {}
