import { NgModule } from "@angular/core";

import { DrawerBodyComponent } from "./drawer-body.component";
import { DrawerCloseDirective } from "./drawer-close.directive";
import { DrawerHeaderComponent } from "./drawer-header.component";
import { DrawerComponent } from "./drawer.component";

@NgModule({
  imports: [DrawerComponent, DrawerHeaderComponent, DrawerBodyComponent, DrawerCloseDirective],
  exports: [DrawerComponent, DrawerHeaderComponent, DrawerBodyComponent, DrawerCloseDirective],
})
export class DrawerModule {}
