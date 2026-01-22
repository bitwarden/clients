import { NgModule } from "@angular/core";

import { BadgeListComponent } from "./badge-list.component";

/**
 * Module providing the badge list component for displaying collections of badges.
 */
@NgModule({
  imports: [BadgeListComponent],
  exports: [BadgeListComponent],
})
export class BadgeListModule {}
