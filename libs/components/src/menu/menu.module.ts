import { NgModule } from "@angular/core";

import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemDirective } from "./menu-item.directive";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

@NgModule({
  imports: [MenuComponent, MenuTriggerForDirective, MenuItemDirective, MenuDividerComponent],
  exports: [MenuComponent, MenuTriggerForDirective, MenuItemDirective, MenuDividerComponent],
})
export class MenuModule {}
