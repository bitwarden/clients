import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { SideNavService } from "./side-nav.service";

/**
 * A visual divider for separating navigation items in the side navigation.
 */
@Component({
  selector: "bit-nav-divider",
  templateUrl: "./nav-divider.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavDividerComponent {
  protected readonly sideNavService = inject(SideNavService);
}
