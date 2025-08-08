import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";
import { RouterLinkActive, RouterLink } from "@angular/router";

import { Icon } from "../icon";
import { BitIconComponent } from "../icon/icon.component";
import { BitwardenShield } from "../icon/logos";

import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-nav-logo",
  templateUrl: "./nav-logo.component.html",
  imports: [CommonModule, RouterLinkActive, RouterLink, BitIconComponent],
})
export class NavLogoComponent {
  /** Icon that is displayed when the side nav is closed */
  readonly closedIcon = input(BitwardenShield);

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
