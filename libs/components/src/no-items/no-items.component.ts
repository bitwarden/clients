import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { NoResults } from "@bitwarden/assets/svg";

import { SvgComponent } from "../svg/svg.component";

/**
 * Component for displaying a message when there are no items to display. Expects title, description and button slots.
 */
@Component({
  selector: "bit-no-items",
  templateUrl: "./no-items.component.html",
  imports: [SvgComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoItemsComponent {
  readonly icon = input(NoResults);
}
