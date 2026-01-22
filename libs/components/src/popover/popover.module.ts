import { NgModule } from "@angular/core";

import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";

/**
 * Module providing popover components for contextual overlays.
 */
@NgModule({
  imports: [PopoverComponent, PopoverTriggerForDirective],
  exports: [PopoverComponent, PopoverTriggerForDirective],
})
export class PopoverModule {}
