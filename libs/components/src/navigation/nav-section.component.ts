import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { IconComponent } from "../icon";
import { BitwardenIcon } from "../shared/icon";

import { NavGroupComponent } from "./nav-group.component";
import { SideNavService } from "./side-nav.service";

let nextId = 0;

/**
 * A titled section grouping for the side navigation. Renders an uppercase heading and
 * semantically groups the projected nav items beneath it. When the side nav is collapsed the
 * heading is visually hidden (sr-only) while the grouped items keep their icons visible in the rail.
 */
@Component({
  selector: "bit-nav-section",
  templateUrl: "./nav-section.component.html",
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavSectionComponent {
  protected readonly sideNavService = inject(SideNavService);
  private readonly parentNavGroup = inject(NavGroupComponent, { optional: true });

  /** `true` when this section is rendered inside a `bit-nav-group`. */
  protected readonly isInNavGroup = this.parentNavGroup != null;

  /** Section heading text, e.g. "Manage". Displayed uppercased via CSS. */
  readonly label = input.required<string>();

  /** Optional icon rendered before the label, e.g. "bwi-folder". */
  readonly icon = input<BitwardenIcon>();

  /** Unique id linking the heading to the group via aria-labelledby. */
  protected readonly labelId = `bit-nav-section-${nextId++}`;
}
