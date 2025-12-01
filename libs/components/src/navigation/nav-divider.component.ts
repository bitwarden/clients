import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { SideNavService } from "./side-nav.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-nav-divider",
  templateUrl: "./nav-divider.component.html",
  imports: [CommonModule],
})
export class NavDividerComponent {
  constructor(protected sideNavService: SideNavService) {}
}
