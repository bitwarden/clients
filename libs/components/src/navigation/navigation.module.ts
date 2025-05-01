import { NgModule } from "@angular/core";

import { NavDividerComponent } from "./nav-divider.component";
import { NavGroupComponent } from "./nav-group.component";
import { NavItemComponent } from "./nav-item.component";
import { NavLogoComponent } from "./nav-logo.component";
import { SideNavComponent } from "./side-nav.component";

@NgModule({
  imports: [
    NavDividerComponent,
    NavGroupComponent,
    NavItemComponent,
    NavLogoComponent,
    SideNavComponent,
  ],
  exports: [
    NavDividerComponent,
    NavGroupComponent,
    NavItemComponent,
    NavLogoComponent,
    SideNavComponent,
  ],
})
export class NavigationModule {}
