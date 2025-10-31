import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { SideNavService } from "./side-nav.service";

/**
 * A visual divider for separating navigation items in the side navigation.
 */
@Component({
  selector: "bit-nav-divider",
  templateUrl: "./nav-divider.component.html",
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavDividerComponent {
  protected readonly sideNavService = inject(SideNavService);
}
