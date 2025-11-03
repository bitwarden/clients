import { ChangeDetectionStrategy, Component, input, inject } from "@angular/core";
import { RouterLinkActive, RouterLink } from "@angular/router";

import { BitwardenShield, Icon } from "@bitwarden/assets/svg";

import { BitIconComponent } from "../icon/icon.component";

import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-nav-logo",
  templateUrl: "./nav-logo.component.html",
  imports: [RouterLinkActive, RouterLink, BitIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavLogoComponent {
  protected readonly sideNavService = inject(SideNavService);

  /**
   * Icon that is displayed when the side nav is closed
   *
   * @default BitwardenShield
   */
  readonly closedIcon = input(BitwardenShield);

  /**
   * Icon that is displayed when the side nav is open
   */
  readonly openIcon = input.required<Icon>();

  /**
   * Route to be passed to internal `routerLink`
   */
  readonly route = input.required<string | any[]>();

  /**
   * Passed to `attr.aria-label` and `attr.title`
   */
  readonly label = input.required<string>();
}
