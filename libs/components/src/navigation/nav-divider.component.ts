import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-nav-divider",
  templateUrl: "./nav-divider.component.html",
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavDividerComponent {
  constructor(protected sideNavService: SideNavService) {}
}
