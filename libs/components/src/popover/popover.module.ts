import { NgModule } from "@angular/core";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverFooterDirective } from "./popover-footer.directive";
import { PopoverHeaderDirective } from "./popover-header.directive";
import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";

@NgModule({
  imports: [
    PopoverComponent,
    PopoverAnchorForDirective,
    PopoverTriggerForDirective,
    PopoverHeaderDirective,
    PopoverFooterDirective,
  ],
  exports: [
    PopoverComponent,
    PopoverAnchorForDirective,
    PopoverTriggerForDirective,
    PopoverHeaderDirective,
    PopoverFooterDirective,
  ],
})
export class PopoverModule {}
