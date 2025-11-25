import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { NavigationModule, SideNavVariant } from "@bitwarden/components";

@Component({
  selector: "app-desktop-side-nav",
  templateUrl: "desktop-side-nav.component.html",
  imports: [CommonModule, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopSideNavComponent {
  readonly variant = input<SideNavVariant>("primary");
}
