import { NgModule } from "@angular/core";

import { MenuCloseDirective } from "./menu-close.directive";
import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemComponent } from "./menu-item.component";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

@NgModule({
  imports: [
    MenuComponent,
    MenuTriggerForDirective,
    MenuItemComponent,
    MenuDividerComponent,
    MenuCloseDirective,
  ],
  exports: [
    MenuComponent,
    MenuTriggerForDirective,
    MenuItemComponent,
    MenuDividerComponent,
    MenuCloseDirective,
  ],
})
export class MenuModule {}
