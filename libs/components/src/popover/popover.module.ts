import { NgModule } from "@angular/core";

import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";

@NgModule({
  imports: [PopoverComponent, PopoverTriggerForDirective],
  exports: [PopoverComponent, PopoverTriggerForDirective],
})
export class PopoverModule {}
