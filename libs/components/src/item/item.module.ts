import { NgModule } from "@angular/core";

import { ItemActionComponent } from "./item-action.component";
import { ItemContentComponent } from "./item-content.component";
import { ItemGroupComponent } from "./item-group.component";
import { ItemComponent } from "./item.component";

/**
 * Module providing item components for displaying list entries with content and actions.
 */
@NgModule({
  imports: [ItemComponent, ItemContentComponent, ItemActionComponent, ItemGroupComponent],
  exports: [ItemComponent, ItemContentComponent, ItemActionComponent, ItemGroupComponent],
})
export class ItemModule {}
