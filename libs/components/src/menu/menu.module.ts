import { NgModule } from "@angular/core";

import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemComponent } from "./menu-item.directive";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

@NgModule({
  imports: [MenuComponent, MenuTriggerForDirective, MenuItemComponent, MenuDividerComponent],
  exports: [MenuComponent, MenuTriggerForDirective, MenuItemComponent, MenuDividerComponent],
})
export class MenuModule {}
