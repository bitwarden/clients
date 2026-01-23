import { NgModule } from "@angular/core";

import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemComponent } from "./menu-item.component";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

/**
 * Module providing menu components for dropdown navigation and action lists.
 */
@NgModule({
  imports: [MenuComponent, MenuTriggerForDirective, MenuItemComponent, MenuDividerComponent],
  exports: [MenuComponent, MenuTriggerForDirective, MenuItemComponent, MenuDividerComponent],
})
export class MenuModule {}
