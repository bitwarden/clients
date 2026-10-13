import { NgModule } from "@angular/core";

import { NavDividerComponent } from "./nav-divider.component";
import { NavGroupComponent } from "./nav-group.component";
import { NavItemComponent } from "./nav-item.component";
import { NavLogoComponent } from "./nav-logo.component";
import { NavSectionEmptyComponent } from "./nav-section-empty.component";
import { NavSectionComponent } from "./nav-section.component";
import { SideNavComponent } from "./side-nav.component";

@NgModule({
  imports: [
    NavDividerComponent,
    NavGroupComponent,
    NavItemComponent,
    NavLogoComponent,
    NavSectionComponent,
    NavSectionEmptyComponent,
    SideNavComponent,
  ],
  exports: [
    NavDividerComponent,
    NavGroupComponent,
    NavItemComponent,
    NavLogoComponent,
    NavSectionComponent,
    NavSectionEmptyComponent,
    SideNavComponent,
  ],
})
export class NavigationModule {}
