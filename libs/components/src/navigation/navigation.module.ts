import { A11yModule } from "@angular/cdk/a11y";
import { OverlayModule } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { IconModule } from "../icon";
import { IconButtonModule } from "../icon-button/icon-button.module";
import { LinkModule } from "../link";
import { SharedModule } from "../shared/shared.module";

import { NavDividerComponent } from "./nav-divider.component";
import { NavGroupComponent } from "./nav-group.component";
import { NavItemComponent } from "./nav-item.component";
import { NavLogoComponent } from "./nav-logo.component";
import { SideNavComponent } from "./side-nav.component";

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    IconButtonModule,
    OverlayModule,
    RouterModule,
    IconModule,
    A11yModule,
    LinkModule,
  ],
  declarations: [
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
