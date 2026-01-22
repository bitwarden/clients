import { NgModule } from "@angular/core";

import { NoItemsComponent } from "./no-items.component";

/**
 * Module providing the no items component for empty state displays.
 */
@NgModule({
  imports: [NoItemsComponent],
  exports: [NoItemsComponent],
})
export class NoItemsModule {}
