import { A11yModule } from "@angular/cdk/a11y";
import { OverlayModule } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { AsyncActionsModule } from "../async-actions";

import { MenuDividerComponent } from "./menu-divider.component";
import { MenuItemComponent } from "./menu-item.component";
import { MenuTriggerForDirective } from "./menu-trigger-for.directive";
import { MenuComponent } from "./menu.component";

@NgModule({
  imports: [A11yModule, CommonModule, OverlayModule, AsyncActionsModule],
  declarations: [MenuComponent, MenuTriggerForDirective, MenuItemComponent, MenuDividerComponent],
  exports: [MenuComponent, MenuTriggerForDirective, MenuItemComponent, MenuDividerComponent],
})
export class MenuModule {}
