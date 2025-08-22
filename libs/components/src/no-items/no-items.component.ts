import { Component, input } from "@angular/core";

import { Search } from "@bitwarden/assets/svg";

import { BitIconComponent } from "../icon/icon.component";

/**
 * Component for displaying a message when there are no items to display. Expects title, description and button slots.
 */
@Component({
  selector: "bit-no-items",
  templateUrl: "./no-items.component.html",
  imports: [BitIconComponent],
})
export class NoItemsComponent {
  readonly icon = input(Search);
}
