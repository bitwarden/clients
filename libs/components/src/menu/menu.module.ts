import { NgModule } from "@angular/core";

import { ContextMenuTriggerForDirective } from "./context-menu-trigger-for.directive";
import { MenuCloseDirective } from "./menu-close.directive";
import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemComponent } from "./menu-item.component";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

@NgModule({
  imports: [
    MenuComponent,
    MenuTriggerForDirective,
    ContextMenuTriggerForDirective,
    MenuItemComponent,
    MenuDividerComponent,
    MenuCloseDirective,
  ],
  exports: [
    MenuComponent,
    MenuTriggerForDirective,
    ContextMenuTriggerForDirective,
    MenuItemComponent,
    MenuDividerComponent,
    MenuCloseDirective,
  ],
})
export class MenuModule {}
