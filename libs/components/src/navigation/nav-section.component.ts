import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { IconComponent } from "../icon";
import { BitwardenIcon } from "../shared/icon";

import { NavGroupComponent } from "./nav-group.component";
import { SideNavService } from "./side-nav.service";

let nextId = 0;

/**
 * Side-nav row grouping with an optional uppercase heading. With a label, its items form a named
 * group whose heading goes sr-only in the collapsed rail.
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

  /** Section heading, e.g. "Manage". Omit for unheaded rows with no group role. */
  readonly label = input<string>();

  /** Optional icon rendered before the label, e.g. "bwi-folder". */
  readonly icon = input<BitwardenIcon>();

  /** Unique id linking the heading to the group via aria-labelledby. */
  protected readonly labelId = `bit-nav-section-${nextId++}`;
}
