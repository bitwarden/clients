import { NgModule } from "@angular/core";

import { ItemActionComponent } from "./item-action.component";
import { ItemContentComponent } from "./item-content.component";
import { ItemGroupAccordionComponent } from "./item-group-accordion.component";
import { ItemGroupComponent } from "./item-group.component";
import { ItemComponent } from "./item.component";

@NgModule({
  imports: [
    ItemComponent,
    ItemContentComponent,
    ItemActionComponent,
    ItemGroupComponent,
    ItemGroupAccordionComponent,
  ],
  exports: [
    ItemComponent,
    ItemContentComponent,
    ItemActionComponent,
    ItemGroupComponent,
    ItemGroupAccordionComponent,
  ],
})
export class ItemModule {}
