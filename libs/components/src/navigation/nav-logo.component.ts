// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { Component, input } from "@angular/core";
import { RouterLinkActive, RouterLink } from "@angular/router";

import { Icon } from "../icon";
import { BitIconComponent } from "../icon/icon.component";

import { NavItemComponent } from "./nav-item.component";
import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-nav-logo",
  templateUrl: "./nav-logo.component.html",
  imports: [RouterLinkActive, RouterLink, BitIconComponent, NavItemComponent],
})
export class NavLogoComponent {
  /** Icon that is displayed when the side nav is closed */
  readonly closedIcon = input("bwi-shield");

  /** Icon that is displayed when the side nav is open */
  readonly openIcon = input.required<Icon>();

  /**
   * Route to be passed to internal `routerLink`
   */
  readonly route = input.required<string | any[]>();

  /** Passed to `attr.aria-label` and `attr.title` */
  readonly label = input.required<string>();

  constructor(protected sideNavService: SideNavService) {}
}
