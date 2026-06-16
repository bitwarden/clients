import { NgModule } from "@angular/core";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";
import { PopoverFooterComponent } from "./popover-footer.component";
import { PopoverHeaderComponent } from "./popover-header.component";
import { PopoverTriggerForDirective } from "./popover-trigger-for.directive";
import { PopoverComponent } from "./popover.component";

@NgModule({
  imports: [
    PopoverComponent,
    PopoverAnchorForDirective,
    PopoverTriggerForDirective,
    PopoverHeaderComponent,
    PopoverFooterComponent,
  ],
  exports: [
    PopoverComponent,
    PopoverAnchorForDirective,
    PopoverTriggerForDirective,
    PopoverHeaderComponent,
    PopoverFooterComponent,
  ],
})
export class PopoverModule {}
