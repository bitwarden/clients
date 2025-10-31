import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLinkActive, RouterLink } from "@angular/router";

import { BitwardenShield, Icon } from "@bitwarden/assets/svg";

import { BitIconComponent } from "../icon/icon.component";

import { SideNavService } from "./side-nav.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-nav-logo",
  templateUrl: "./nav-logo.component.html",
  imports: [CommonModule, RouterLinkActive, RouterLink, BitIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
