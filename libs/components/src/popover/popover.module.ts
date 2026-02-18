import { NgModule } from "@angular/core";

import { PopoverAnchorDirective } from "./popover-anchor.directive";
import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";

@NgModule({
  imports: [PopoverComponent, PopoverAnchorDirective, PopoverTriggerForDirective],
  exports: [PopoverComponent, PopoverAnchorDirective, PopoverTriggerForDirective],
})
export class PopoverModule {}
