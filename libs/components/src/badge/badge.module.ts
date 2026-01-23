import { NgModule } from "@angular/core";

import { BadgeComponent } from "./badge.component";

/**
 * Module providing the badge component for labels, counters, and small buttons.
 */
@NgModule({
  imports: [BadgeComponent],
  exports: [BadgeComponent],
})
export class BadgeModule {}
