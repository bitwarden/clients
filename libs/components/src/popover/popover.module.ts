import { NgModule } from "@angular/core";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";

@NgModule({
  imports: [PopoverComponent, PopoverAnchorForDirective, PopoverTriggerForDirective],
  exports: [PopoverComponent, PopoverAnchorForDirective, PopoverTriggerForDirective],
})
export class PopoverModule {}
