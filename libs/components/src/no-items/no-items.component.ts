import { Component, Input } from "@angular/core";

import { Icons } from "..";
import { BitIconComponent } from "../icon/icon.component";

/**
 * Component for displaying a message when there are no items to display. Expects title, description and button slots.
 */
@Component({
  selector: "bit-no-items",
  templateUrl: "./no-items.component.html",
  standalone: true,
  imports: [BitIconComponent],
})
export class NoItemsComponent {
  @Input() icon = Icons.Search;
}
